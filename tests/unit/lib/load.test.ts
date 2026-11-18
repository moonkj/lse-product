/**
 * 단위 테스트 (UT-02) — src/data/load.ts 의 제품 연결·사진 URL 규칙 (v0.5 R2)
 *  - resolveProducts: 직접 productIds ∪ 카테고리 제품 ∪ **하위 카테고리 제품**(M3, R-01), 중복 제거, 없는 id 무시
 *  - 사진: 계통도 타일 = 160px 썸네일(images/equipment/thumb/), 패널·기기 페이지 큰 사진 = 원본(images/equipment/)
 */
import { describe, it, expect } from 'vitest';
import { equipmentImageUrl, equipmentThumbUrl, getData, resolveProducts, type AppData } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import type { Category, EquipmentType, Product } from '../../../src/lib/schema';

const prod = (id: string, categoryCode: string): Product =>
  ({ id, name: id, categoryCode, categoryPath: [], url: `https://www.ls-electric.com/ko/product/view/${id}`, business: 'automation', discontinued: false, docs: [] }) as unknown as Product;
const cat = (code: string, productIds: string[], parentCode?: string): Category =>
  ({ code, name: code, parentCode, productIds, url: 'https://www.ls-electric.com/' }) as unknown as Category;
const eq = (over: Partial<EquipmentType>): EquipmentType =>
  ({ id: 'x', name: '기기', layer: 'L6', voltage: '', category: 'drive', description: '', learnPoints: [], coverage: 'owned', lseCategoryCodes: [], ...over }) as EquipmentType;

function fakeData(products: Product[], categories: Category[]): AppData {
  return {
    ...getData(),
    products,
    categories,
    productById: new Map(products.map((p) => [p.id, p])),
    categoryByCode: new Map(categories.map((c) => [c.code, c])),
  };
}

describe('UT-02 resolveProducts (M3: 하위 카테고리 포함)', () => {
  const products = [prod('P00001', 'BBB005'), prod('P00002', 'BBB005018'), prod('P00003', 'BBB005018001'), prod('P00009', 'CCC001')];
  const categories = [cat('BBB005', ['P00001']), cat('BBB005018', ['P00002'], 'BBB005'), cat('BBB005018001', ['P00003'], 'BBB005018'), cat('CCC001', ['P00009'])];
  const data = fakeData(products, categories);
  const ids = (e: EquipmentType) => resolveProducts(e, data).map((p) => p.id).sort();

  it('상위 카테고리 코드만 지정해도 하위(손자 포함) 카테고리 제품까지 포함', () => {
    expect(ids(eq({ lseCategoryCodes: ['BBB005'] }))).toEqual(['P00001', 'P00002', 'P00003']);
  });
  it('하위 코드 지정 시 상위·형제 카테고리 제품은 포함하지 않음', () => {
    expect(ids(eq({ lseCategoryCodes: ['BBB005018'] }))).toEqual(['P00002', 'P00003']);
  });
  it('직접 productIds 와 합치고 중복 제거, 없는 제품 id 는 무시', () => {
    expect(ids(eq({ lseCategoryCodes: ['BBB005018'], productIds: ['P00002', 'P00009', 'P99999'] }))).toEqual(['P00002', 'P00003', 'P00009']);
  });
  it('카테고리·productIds 모두 없으면 빈 배열', () => {
    expect(ids(eq({}))).toEqual([]);
  });
});

describe('UT-03 기기 사진 URL: 타일 = thumb, 큰 사진 = 원본', () => {
  const [id, img] = [...getData().equipmentImageById.entries()][0] ?? [];

  it.skipIf(!id)('equipmentImageUrl = 원본(file), equipmentThumbUrl = thumb', () => {
    expect(equipmentImageUrl(id!)).toMatch(new RegExp(`${img!.file.replace(/\./g, '\\.')}$`));
    expect(equipmentImageUrl(id!)).not.toContain('/thumb/');
    expect(equipmentThumbUrl(id!)).toMatch(new RegExp(`images/equipment/thumb/[^/]+$`));
  });

  it('사진 없는 기기는 undefined (심볼 표시)', () => {
    expect(equipmentImageUrl('__none__')).toBeUndefined();
    expect(equipmentThumbUrl('__none__')).toBeUndefined();
  });

  it('계통도 타일(getDiagramModel node.imageUrl)은 썸네일 경로 (구현 대기: R2)', () => {
    const withImg = getDiagramModel().nodes.filter((n) => n.imageUrl);
    expect(withImg.length).toBeGreaterThan(0);
    expect(withImg.filter((n) => !n.imageUrl!.includes('images/equipment/thumb/')).map((n) => `${n.id}: ${n.imageUrl}`)).toEqual([]);
  });
});
