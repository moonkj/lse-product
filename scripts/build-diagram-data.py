"""계통도 기본 데이터 생성기 (리더 관리).

출력: src/data/equipment-types.json, src/data/diagram.json
실행: python3 scripts/build-diagram-data.py
좌표는 노드 중심점. 레이어 L1~L7은 왼쪽 본선 영역(x 0~1200)의 가로 밴드,
MON(감시)·REN(신재생 연계)은 오른쪽 열(x 1220~1600)에 배치한다.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data"

# ---------------------------------------------------------------- layers
MAIN_W, SIDE_X, W = 1200, 1220, 1600
LAYERS = [
    {"id": "L1", "label": "초고압 발전·송전", "voltage": "765/345kV", "y": 0, "height": 300},
    {"id": "L2", "label": "송변전", "voltage": "154kV", "y": 300, "height": 300},
    {"id": "L3", "label": "특고압 배전", "voltage": "22.9kV", "y": 600, "height": 300},
    {"id": "L4", "label": "수전설비", "voltage": "22.9kV", "y": 900, "height": 300},
    {"id": "L5", "label": "변압", "voltage": "22.9kV→380/220V", "y": 1200, "height": 300},
    {"id": "L6", "label": "저압 배전", "voltage": "380/220V", "y": 1500, "height": 300},
    {"id": "L7", "label": "분전반 및 부하", "voltage": "380/220V 분기", "y": 1800, "height": 360},
]
for l in LAYERS:
    l.update(x=0, width=MAIN_W)
LAYERS += [
    {"id": "MON", "label": "감시·제어", "voltage": "통신", "x": SIDE_X, "width": W - SIDE_X, "y": 0, "height": 900},
    {"id": "REN", "label": "신재생·저장 연계", "voltage": "계층별 연계", "x": SIDE_X, "width": W - SIDE_X, "y": 900, "height": 1260},
]
H = 2160

# ---------------------------------------------------------------- equipment types
# (id, name, abbr, layer, voltage, category, coverage, codes, productIds, extra, description, learnPoints)
def eq(id, name, abbr, layer, voltage, category, coverage, codes=(), pids=(), extra=None, desc="", learn=()):
    d = {"id": id, "name": name, "layer": layer, "voltage": voltage, "category": category,
         "description": desc, "learnPoints": list(learn), "coverage": coverage,
         "lseCategoryCodes": list(codes)}
    if abbr:
        d["abbr"] = abbr
    if pids:
        d["productIds"] = list(pids)
    if extra:
        d.update(extra)
    return d

CHECK = {"gapNote": "홈페이지 제품 목록에서 찾지 못함 — 실제 미보유 여부 확인 필요"}

EQUIPMENT = [
    # L1 ---------------------------------------------------------------
    eq("generator", "발전기", "G", "L1", "수~25kV", "generation", "missing", extra=CHECK,
       desc="연료·수력·원자력 등의 에너지를 전기로 바꾸는 계통의 시작점.",
       learn=["발전 전압은 보통 수십 kV 이하라 바로 승압이 필요", "계통 주파수(60Hz)를 유지하는 주체"]),
    eq("step-up-tr", "승압 변압기", "MTR", "L1", "발전전압→345kV", "transformation", "owned", ["AAA009005"],
       desc="발전기 전압을 송전 전압(345/765kV)으로 올려 먼 거리를 적은 손실로 보낸다.",
       learn=["전압을 높이면 같은 전력에서 전류가 줄어 선로 손실(I²R)이 감소", "최고 전압 등급은 제품별 사양 확인"]),
    eq("ehv-gis", "초고압 가스절연개폐장치", "GIS", "L1", "345kV급", "switching", "owned", ["AAA009004"],
       desc="차단기·단로기·접지개폐기·CT/PT를 SF6 등 절연가스로 채운 금속함에 넣은 개폐장치.",
       learn=["공기절연(AIS) 대비 설치 면적이 크게 작음", "차단기(GCB)는 고장전류를 끊고, 단로기는 무부하 상태에서 회로를 분리"]),
    eq("la-ehv", "피뢰기 (초고압)", "LA", "L1", "345kV급", "protection", "missing", extra=CHECK,
       desc="낙뢰·개폐 서지가 들어오면 대지로 방전시켜 기기 절연을 보호한다.",
       learn=["변압기·GIS 인입부에 설치", "정상 전압에서는 절연체처럼 동작"]),
    eq("ct-pt-ehv", "계기용 변성기 (초고압 단독형)", "CT/PT", "L1", "345kV급", "measurement", "missing", extra=CHECK,
       desc="큰 전류·전압을 계측·보호용 작은 값(5A, 110V 등)으로 바꾼다.",
       learn=["CT 2차측은 절대 개방하면 안 됨(고전압 발생)", "GIS 내장형은 GIS 제품에 포함"]),
    eq("transmission-line", "송전선로·전력케이블", None, "L1", "345/765kV", "conductor", "affiliate",
       extra={"affiliateName": "LS전선"},
       desc="발전소와 변전소를 잇는 가공선로 또는 지중 케이블.",
       learn=["765kV는 국내 최고 송전 전압", "케이블은 계열사 LS전선 영역"]),
    eq("hvdc", "초고압 직류송전", "HVDC", "L1", "±kV DC", "system", "owned", ["AAA009003"],
       desc="교류를 직류로 바꿔 장거리·해저로 송전한 뒤 다시 교류로 변환하는 시스템.",
       learn=["장거리·해저 송전에서 교류보다 손실이 적음", "서로 다른 계통(주파수)을 연결할 수 있음"]),
    eq("facts", "유연송전시스템", "FACTS", "L1", "송전급", "system", "owned", ["AAA009002"],
       desc="전력전자 장치로 송전선의 전압·조류를 빠르게 제어해 송전 용량과 안정도를 높인다.",
       learn=["STATCOM, SVC 등이 대표적"]),
    eq("relay-tx", "송전용 보호계전 시스템", None, "L1", "송전급", "protection", "partial", ["AAA016001"],
       extra={"gapNote": "자사 디지털 보호계전기(GIPAM 등)는 배전·수전급 중심 — 송전급 라인업 확인 필요"},
       desc="송전선·변압기 고장을 검출해 차단기에 트립 신호를 보낸다.",
       learn=["거리계전·차동계전 방식이 주로 쓰임"]),
    # L2 ---------------------------------------------------------------
    eq("substation", "변전소 (일괄 공급)", None, "L2", "154kV", "system", "owned", ["AAA009001"],
       desc="송전 전압을 배전 전압으로 낮추고 계통을 나누는 설비 전체(EPC).",
       learn=["GIS·주변압기·보호·감시를 묶어 공급"]),
    eq("gis-154", "154kV 가스절연개폐장치", "GIS", "L2", "154kV", "switching", "owned", ["AAA009004"],
       desc="변전소의 154kV 모선과 선로를 개폐·보호한다.",
       learn=["모선(Bus)은 여러 회선을 모으는 공통 도체"]),
    eq("main-tr", "주변압기", "MTR", "L2", "154/22.9kV", "transformation", "owned", ["AAA009005"],
       desc="154kV를 배전 전압 22.9kV로 낮추는 변전소 핵심 기기.",
       learn=["용량 단위는 MVA", "탭 절환으로 2차 전압을 조정"]),
    eq("sas", "변전소 자동화 시스템", "SAS", "L2", "154kV", "monitoring", "owned", ["AAA003003"],
       desc="변전소 내 보호·제어·계측 장치를 디지털 통신(IEC 61850)으로 통합한다.",
       learn=["IEC 61850은 변전소 통신 국제 표준"]),
    # L3 ---------------------------------------------------------------
    eq("fcl", "한류기", "FCL", "L3", "22.9kV", "protection", "owned", ["AAA010005"],
       desc="고장 시 순간적으로 임피던스를 높여 고장전류 크기를 제한한다.",
       learn=["차단기 차단용량 초과 문제를 해결"]),
    eq("dist-line", "배전선로·케이블", None, "L3", "22.9kV", "conductor", "affiliate",
       extra={"affiliateName": "LS전선"},
       desc="변전소에서 수용가까지 전기를 나르는 22.9kV 선로.",
       learn=["국내 배전은 22.9kV-Y 다중접지 방식"]),
    eq("recloser", "리클로저", "R/C", "L3", "22.9kV", "protection", "missing", extra=CHECK,
       desc="선로 고장 시 차단 후 자동으로 재투입해 일시 고장을 스스로 복구한다.",
       learn=["배전 고장의 대부분은 일시 고장(나뭇가지, 낙뢰 등)"]),
    eq("auto-switch", "배전용 가스절연 부하개폐기", "RMU", "L3", "22.9kV", "switching", "owned",
       pids=["P03080"],
       desc="배전선로를 구간별로 나누고 부하전류를 개폐한다. 배전자동화 단말과 연계된다.",
       learn=["부하개폐기는 부하전류는 끊지만 고장전류는 못 끊음"]),
    eq("pole-tr", "주상변압기", "P.Tr", "L3", "22.9kV/220-380V", "transformation", "missing", extra=CHECK,
       desc="전주 위에 설치해 소규모 수용가(주택·상가)에 저압을 공급한다.",
       learn=["대형 수용가는 자체 수전설비(L4)를 갖춤"]),
    # L4 ---------------------------------------------------------------
    eq("mv-swgr", "특고압 수배전반", None, "L4", "22.9kV", "system", "owned",
       pids=["P01097", "P01098", "P01100", "P02201", "P02202", "P02203"],
       desc="수전설비 기기들을 넣은 함(패널). MCSG, C-GIS, C-AIS, DAIS 등 방식이 있다.",
       learn=["C-GIS는 가스절연, C-AIS는 공기절연 방식"]),
    eq("lbs", "부하개폐기 / 자동고장구분개폐기", "LBS/ASS", "L4", "22.9kV", "switching", "owned", ["AAA015007"],
       pids=["P03077", "P03078"],
       desc="수전 인입구에서 회로를 개폐하고(LBS), 수용가 고장을 계통에서 자동 분리한다(ASS).",
       learn=["ASS는 수용가 내부 고장이 배전선로로 번지는 것을 막음"]),
    eq("la", "피뢰기", "LA", "L4", "22.9kV", "protection", "missing", extra=CHECK,
       desc="인입선으로 들어오는 서지를 대지로 방전해 수전설비를 보호한다.",
       learn=["보통 인입 개폐기 바로 뒤에 설치"]),
    eq("alts", "자동부하 전환개폐기", "ALTS", "L4", "22.9kV", "switching", "owned", ["AAA015006"],
       desc="주 전원(상용) 정전 시 예비 전원 선로로 자동 전환한다.",
       learn=["병원·데이터센터처럼 2회선 수전하는 곳에 사용"]),
    eq("mof", "전력수급용 계기용변성기", "MOF", "L4", "22.9kV", "measurement", "missing", extra=CHECK,
       desc="한전 거래용 전력량계에 맞게 전압·전류를 낮추는 변성기(CT+PT 일체).",
       learn=["한전과 요금을 정산하는 기준점"]),
    eq("meter", "전력량계", "WHM", "L4", "22.9kV", "measurement", "owned", ["AAA016003"],
       desc="사용한 전력량(kWh)을 계량한다.",
       learn=["MOF 2차측에 연결"]),
    eq("pf", "한류형 전력퓨즈", "PF", "L4", "22.9kV", "protection", "owned", ["AAA015004"],
       desc="단락 시 녹아 끊어지며 고장전류를 빠르게 제한·차단한다.",
       learn=["소용량 변압기 보호에 차단기 대신 경제적으로 사용"]),
    eq("vcb", "진공차단기", "VCB", "L4", "7.2~25.8kV", "switching", "owned", ["AAA015001"],
       desc="진공 속에서 아크를 소호해 부하전류와 고장전류를 모두 차단한다.",
       learn=["보호계전기의 트립 신호로 동작", "핵심 부품은 진공 인터럽터(VI)"]),
    eq("ct-pt", "계기용 변류기·변압기", "CT/PT", "L4", "22.9kV", "measurement", "missing", extra=CHECK,
       desc="보호계전기·계측기에 입력할 전류·전압 신호를 만든다.",
       learn=["CT 2차 정격은 보통 5A 또는 1A"]),
    eq("protection-relay", "디지털 보호계전기", "OCR/OCGR", "L4", "22.9kV", "protection", "owned", ["AAA016001"],
       desc="CT/PT 신호로 과전류·지락 등 고장을 판단해 차단기를 트립시킨다.",
       learn=["GIPAM 시리즈가 대표 제품", "OCR=과전류, OCGR=지락과전류"]),
    eq("vc-vi", "고압 전자접촉기·진공 인터럽터", "VC/VI", "L4", "3.3~6.6kV", "switching", "owned",
       ["AAA015002", "AAA015003"],
       desc="고압 전동기처럼 자주 켜고 끄는 부하를 개폐한다(VC). VI는 차단기·접촉기의 핵심 부품.",
       learn=["VC는 개폐 수명이 길고, 차단은 PF와 조합"]),
    eq("mv-drive", "고압 인버터", "MV Drive", "L4", "3.3~11kV", "control", "owned", ["BBB006"],
       desc="고압 전동기의 속도를 제어해 팬·펌프의 에너지를 크게 절감한다.",
       learn=["유량 제어를 밸브 대신 회전수로 하면 에너지가 크게 줄어듦"]),
    # L5 ---------------------------------------------------------------
    eq("cast-tr", "몰드변압기", "TR", "L5", "22.9kV/380-220V", "transformation", "owned", pids=["P01110"],
       desc="권선을 에폭시 수지로 몰딩한 건식 변압기. 화재 위험이 적어 건물 내부에 주로 사용.",
       learn=["유입식보다 난연성이 우수", "용량 단위는 kVA"]),
    eq("oil-tr", "유입변압기", "TR", "L5", "22.9kV/380-220V", "transformation", "owned", pids=["P01109"],
       desc="절연유로 냉각·절연하는 변압기. 옥외·대용량에 유리.",
       learn=["절연유 상태 관리(온도·가스 분석)가 중요"]),
    # L6 ---------------------------------------------------------------
    eq("lv-swgr", "저압 배전반", None, "L6", "380/220V", "system", "owned",
       pids=["P01101", "P01103", "P01104", "P02204", "P01102"],
       desc="변압기 2차측 저압 전력을 각 부하 계통으로 나누는 함(패널).",
       learn=["Susol LV SWGR, Power Center 등"]),
    eq("acb", "기중차단기", "ACB", "L6", "380/220V", "switching", "owned", ["AAA014001"],
       desc="변압기 2차 메인 등 대전류(수천 A) 저압 회로를 보호·개폐하는 주차단기.",
       learn=["정격전류 범위가 MCCB보다 큼", "전자식 트립 장치(OCR) 내장"]),
    eq("mccb", "배선용차단기", "MCCB", "L6", "380/220V", "switching", "owned", ["AAA014002"],
       desc="저압 간선·분기 회로를 과부하·단락으로부터 보호한다.",
       learn=["가장 많이 쓰이는 저압 차단기", "AF(프레임)와 AT(트립 정격)를 구분"]),
    eq("busway", "버스웨이", None, "L6", "380/220V", "conductor", "owned", ["AAA010003"],
       desc="케이블 대신 금속 도체(부스바)를 덕트에 넣어 대전류를 공급하는 간선 시스템.",
       learn=["대전류·고층 건물에서 케이블보다 공간·시공에 유리"]),
    eq("spd", "서지보호기", "SPD", "L6", "380/220V", "protection", "owned", ["AAA014008"],
       desc="낙뢰·개폐 서지로부터 저압 기기를 보호한다.",
       learn=["Type1/2/3 등급별로 설치 위치가 다름"]),
    eq("power-meter", "디지털 계측기", "DPM", "L6", "380/220V", "measurement", "owned", ["AAA016002"],
       desc="전압·전류·전력·역률·고조파 등 전력 품질을 측정하고 통신으로 전송한다.",
       learn=["GIMAC 시리즈가 대표 제품"]),
    eq("capacitor", "진상콘덴서·역률제어기", "SC/APFC", "L6", "380/220V", "measurement", "missing", extra=CHECK,
       desc="전동기 등 유도성 부하의 지상 무효전력을 보상해 역률을 개선한다.",
       learn=["역률이 낮으면 전기요금 할증·선로 손실 증가"]),
    eq("sag-protector", "순간전압보상장치", None, "L6", "380/220V", "protection", "owned", ["AAA014009"],
       desc="순간 전압강하(Sag) 때 전원을 보상해 설비 정지를 막는다.",
       learn=["반도체·정밀 공정에서 중요"]),
    eq("aps", "무정전 전원 장치", "APS", "L6", "380/220V", "system", "partial", ["AAA010006"],
       extra={"gapNote": "APS 제품 보유 — 범용 UPS 라인업과의 관계 확인 필요"},
       desc="정전·순간정전 시에도 중요 부하에 전원을 계속 공급한다.",
       learn=["배터리·인버터로 구성"]),
    eq("lv-ats", "저압 자동절환개폐기", "ATS", "L6", "380/220V", "switching", "missing", extra=CHECK,
       desc="상용 전원 정전 시 비상발전기 전원으로 자동 절환한다.",
       learn=["비상 부하(소방·승강기)는 법으로 예비전원 의무"]),
    eq("emergency-gen", "비상발전기", "EG", "L6", "380/220V", "generation", "missing", extra=CHECK,
       desc="정전 시 비상 부하에 전원을 공급하는 디젤·가스 발전기.",
       learn=["ATS와 함께 동작"]),
    eq("mcc", "전동기 제어반", "MCC", "L6", "380/220V", "system", "owned", pids=["P01245"],
       desc="여러 전동기의 기동·보호·제어 기기를 모아 둔 패널.",
       learn=["Smart MCC는 통신으로 원격 감시·제어 가능"]),
    # L7 ---------------------------------------------------------------
    eq("panelboard", "분전반 (함체)", None, "L7", "380/220V", "system", "missing",
       extra={"gapNote": "분전반용 차단기는 공급 — 분전반 함체 완제품 보유 여부 확인 필요"},
       desc="층·구역별로 분기 차단기를 모아 조명·콘센트 회로를 나누는 함.",
       learn=["주택·사무실 벽에 있는 차단기 함이 분전반"]),
    eq("branch-mccb", "분전반용 차단기", None, "L7", "380/220V", "switching", "owned", pids=["P01024"],
       desc="분전반 메인 및 분기용으로 소형화한 배선용차단기.",
       learn=["분전반 버스바에 플러그인 방식으로 설치하기도 함"]),
    eq("elcb", "누전차단기", "ELCB", "L7", "380/220V", "protection", "owned", ["AAA014003"],
       desc="누설전류(감전·누전)를 검출하면 회로를 차단한다.",
       learn=["감도전류 30mA는 인체 보호용", "시험 버튼으로 정기 점검"]),
    eq("mcb-rcbo", "초소형차단기·회로보호기", "MCB/RCBO", "L7", "230/400V", "switching", "owned", ["AAA014004"],
       desc="DIN 레일형 소형 차단기. RCBO는 누전 보호까지 겸한다.",
       learn=["IEC 규격 분전반에서 주로 사용"]),
    eq("lighting-outlet", "조명·콘센트 부하", None, "L7", "220V", "load", "na",
       desc="계통의 최종 소비처. 자사 사업 범위 밖.",
       learn=["분기 회로마다 차단기가 하나씩 보호"]),
    eq("ev-charger", "전기차 충전기", "EVC", "L7", "380/220V", "load", "owned", ["AAA007"],
       desc="급속(DC)·완속(AC) 전기차 충전 설비.",
       learn=["급속은 DC로 차량 배터리에 직접 충전"]),
    eq("mms", "모터보호용 배선용차단기", "MMS", "L7", "380V", "protection", "owned", ["AAA014006"],
       desc="전동기 회로에서 단락·과부하 보호를 함께 수행한다.",
       learn=["MCCB + 열동계전기 기능을 하나로"]),
    eq("ms", "전자개폐기 (MC+열동계전기)", "MC/MS", "L7", "380/220V", "switching", "owned", ["AAA014005"],
       desc="코일 신호로 전동기 회로를 자주 켜고 끈다(MC). 열동계전기(TOR)와 조합하면 MS.",
       learn=["Metasol MS가 대표 제품", "개폐 수명이 차단기보다 훨씬 김"]),
    eq("empr", "전자식 모터보호 계전기", "EMPR", "L7", "380V", "protection", "owned", ["AAA014007"],
       desc="전류를 정밀 측정해 과부하·결상·구속 등 전동기 이상을 보호한다.",
       learn=["열동계전기보다 보호 기능이 다양하고 정확"]),
    eq("soft-starter", "소프트 스타터", None, "L7", "380V", "control", "owned", ["AAA014010", "BBB008"],
       desc="전동기 기동 시 전압을 서서히 올려 기동전류와 충격을 줄인다.",
       learn=["직입 기동 전류는 정격의 6~8배"]),
    eq("lv-drive", "저압 인버터", "VFD", "L7", "220/380V", "control", "owned", ["BBB005"],
       desc="주파수를 바꿔 전동기 속도를 제어한다.",
       learn=["팬·펌프 에너지 절감의 핵심", "iS7, S100, G100 등"]),
    eq("motor", "전동기", "M", "L7", "380V", "load", "partial", ["BBB002003", "BBB002004", "BBB002007"],
       extra={"gapNote": "서보·리니어·DD 모터는 보유, 범용 유도전동기는 미보유 — 확인 필요"},
       desc="전기에너지를 회전력으로 바꾸는 대표 부하.",
       learn=["산업 전력 소비의 큰 비중을 차지"]),
    eq("servo", "서보 드라이브·모션", None, "L7", "220/380V", "control", "owned", ["BBB002"],
       desc="위치·속도를 정밀 제어하는 구동 시스템(드라이브+모터+컨트롤러).",
       learn=["로봇·반도체 장비 등 정밀 위치 제어"]),
    eq("plc", "PLC", "PLC", "L7", "DC24V 제어", "control", "owned", ["BBB001"],
       desc="입력 신호에 따라 프로그램대로 기계를 제어하는 산업용 컨트롤러.",
       learn=["XGT, XGB 시리즈", "XG5000으로 프로그래밍"]),
    eq("hmi", "HMI", "HMI", "L7", "제어", "control", "owned", ["BBB003"],
       desc="작업자가 설비 상태를 보고 조작하는 터치 화면.",
       learn=["XGT Panel 시리즈"]),
    eq("dmc", "디지털계측제어기", "DMC", "L7", "380V", "measurement", "owned", ["AAA014011"],
       desc="MCC 등에서 계측·보호·제어를 하나로 통합한 장치.",
       learn=["통신으로 상위 감시 시스템과 연결"]),
    eq("smart-device", "분기 계측·데이터수집 기기", "DAU", "L7", "380/220V", "measurement", "owned", ["AAA018"],
       desc="분기 회로 계측기, 센서, 데이터수집장치로 현장 데이터를 모은다.",
       learn=["스마트 배전반·에너지 관리의 기초 데이터"]),
    # REN --------------------------------------------------------------
    eq("pv", "태양광 발전", "PV", "REN", "DC→AC", "generation", "owned", ["AAA012"],
       desc="태양전지 모듈로 직류 전력을 생산하는 신재생 발전 시스템.",
       learn=["직류를 PCS(인버터)로 교류로 바꿔 계통에 연계"]),
    eq("pcs", "전력변환장치", "PCS", "REN", "DC↔AC", "control", "owned", ["AAA012", "AAA013"],
       extra={"gapNote": "PV·ESS 솔루션 내 포함 — 단품 라인업 확인 필요"},
       desc="PV·배터리의 직류와 계통의 교류를 상호 변환한다.",
       learn=["ESS용 PCS는 충전·방전 양방향 동작"]),
    eq("ess", "에너지저장장치", "ESS", "REN", "DC", "system", "owned", ["AAA013"],
       desc="배터리에 전기를 저장했다가 필요할 때 공급한다.",
       learn=["피크 저감, 신재생 출력 안정화에 활용"]),
    eq("dc-devices", "DC 전력기기", None, "REN", "DC 1500V 이하", "switching", "owned", ["AAA017"],
       desc="태양광·ESS·DC 배전용 차단기·개폐기·접촉기·SPD·릴레이.",
       learn=["직류는 전류가 0이 되는 순간이 없어 차단이 더 어려움"]),
    eq("microgrid", "마이크로그리드", None, "REN", "계통 연계/독립", "system", "owned", ["AAA006"],
       desc="신재생·ESS·부하를 묶어 독립 운전도 가능한 소규모 전력망.",
       learn=["섬·캠퍼스·산업단지에 적용"]),
    eq("modular-substation", "모듈형 변전설비", "E-House", "REN", "MV/LV", "system", "owned", ["AAA011"],
       desc="변전·배전 기기를 공장에서 컨테이너형으로 조립해 현장에 설치한다.",
       learn=["E-House, MGS, CSS", "공기 단축에 유리"]),
    eq("railway", "철도 전력공급 시스템", None, "REN", "AC/DC 급전", "system", "owned", ["AAA019"],
       desc="전기철도에 전력을 공급하는 AC·DC 급전 설비.",
       learn=["도시철도는 주로 DC 1500V 급전"]),
    # MON --------------------------------------------------------------
    eq("scada", "SCADA (ECMS·PQMS)", "SCADA", "MON", "통신", "monitoring", "owned", ["AAA003"],
       desc="전력 설비를 원격으로 감시·제어하는 상위 시스템.",
       learn=["ECMS=전력 제어, PQMS=전력 품질 감시"]),
    eq("ems", "에너지관리시스템", "EMS", "MON", "통신", "monitoring", "owned", ["AAA002"],
       desc="에너지 생산·소비 데이터를 분석해 최적 운전과 비용 절감을 돕는다.",
       learn=["계통 운영자용 EMS와 수용가용 xEMS를 구분"]),
    eq("dms", "배전관리시스템", "DMS", "MON", "통신", "monitoring", "owned", ["AAA004"],
       desc="배전선로의 개폐기·고장 정보를 모아 고장 구간을 자동 분리·복구한다.",
       learn=["배전자동화의 상위 시스템"]),
    eq("xems", "BEMS·FEMS", "xEMS", "MON", "통신", "monitoring", "owned", ["AAA005"],
       desc="빌딩(BEMS)·공장(FEMS)의 에너지를 관리한다.",
       learn=["일정 규모 이상 건물은 BEMS 설치 의무화 추세"]),
    eq("care", "설비 진단·자산관리", "CARE", "MON", "통신", "monitoring", "owned", ["AAA001"],
       desc="Smart MV/LV, Smart Diagnosis, AMS로 기기 상태를 진단하고 수명을 관리한다.",
       learn=["고장이 나기 전에 예측 정비"]),
    eq("amrs", "원격검침시스템", "AMRS", "MON", "통신", "monitoring", "owned", ["AAA008"],
       desc="전력량계 데이터를 원격으로 자동 수집한다.",
       learn=["검침 인력과 오류를 줄임"]),
]

# ---------------------------------------------------------------- nodes
N = {
    # L1
    "n-gen": ("generator", 100, 150), "n-step-up": ("step-up-tr", 260, 150), "n-ehv-gis": ("ehv-gis", 430, 150),
    "n-la-ehv": ("la-ehv", 430, 50), "n-ct-ehv": ("ct-pt-ehv", 430, 250), "n-relay-tx": ("relay-tx", 260, 250),
    "n-tline": ("transmission-line", 620, 150), "n-hvdc": ("hvdc", 820, 100), "n-facts": ("facts", 820, 210),
    # L2
    "n-substation": ("substation", 180, 450), "n-gis154": ("gis-154", 620, 380), "n-main-tr": ("main-tr", 620, 510),
    "n-sas": ("sas", 860, 450),
    # L3
    "n-fcl": ("fcl", 620, 670), "n-dline": ("dist-line", 620, 790), "n-recloser": ("recloser", 800, 790),
    "n-auto-sw": ("auto-switch", 980, 790), "n-pole-tr": ("pole-tr", 1120, 790),
    # L4
    "n-mv-swgr": ("mv-swgr", 180, 1050), "n-lbs": ("lbs", 620, 945), "n-la": ("la", 470, 945),
    "n-alts": ("alts", 800, 945), "n-mof": ("mof", 620, 1015), "n-meter": ("meter", 470, 1015),
    "n-vcb": ("vcb", 620, 1095), "n-ct-pt": ("ct-pt", 470, 1095), "n-relay": ("protection-relay", 330, 1095),
    "n-pf": ("pf", 800, 1095), "n-vc": ("vc-vi", 960, 1095), "n-mv-drive": ("mv-drive", 1110, 1095),
    # L5
    "n-cast-tr": ("cast-tr", 620, 1350), "n-oil-tr": ("oil-tr", 800, 1350),
    # L6
    "n-lv-swgr": ("lv-swgr", 180, 1650), "n-acb": ("acb", 620, 1550), "n-pmeter": ("power-meter", 460, 1550),
    "n-mccb": ("mccb", 460, 1650), "n-busway": ("busway", 800, 1650), "n-spd": ("spd", 800, 1550),
    "n-cap": ("capacitor", 960, 1550), "n-sag": ("sag-protector", 960, 1650), "n-aps": ("aps", 1110, 1650),
    "n-mcc": ("mcc", 620, 1745), "n-ats": ("lv-ats", 960, 1745), "n-egen": ("emergency-gen", 1110, 1745),
    # L7
    "n-panel": ("panelboard", 300, 1850), "n-elcb": ("elcb", 180, 1960), "n-mcb": ("mcb-rcbo", 300, 1960),
    "n-bmccb": ("branch-mccb", 420, 1960), "n-light": ("lighting-outlet", 240, 2080), "n-evc": ("ev-charger", 420, 2080),
    "n-mms": ("mms", 580, 1850), "n-ms": ("ms", 580, 1960), "n-empr": ("empr", 700, 1960),
    "n-drive": ("lv-drive", 820, 1960), "n-soft": ("soft-starter", 940, 1960), "n-servo": ("servo", 1080, 1960),
    "n-motor": ("motor", 700, 2085), "n-plc": ("plc", 880, 2085), "n-hmi": ("hmi", 1000, 2085),
    "n-dmc": ("dmc", 1110, 1850), "n-smart": ("smart-device", 100, 2080),
    # MON
    "n-scada": ("scada", 1320, 150), "n-ems": ("ems", 1500, 150), "n-dms": ("dms", 1320, 400),
    "n-xems": ("xems", 1500, 400), "n-care": ("care", 1320, 650), "n-amrs": ("amrs", 1500, 650),
    # REN
    "n-pv": ("pv", 1320, 1000), "n-dc": ("dc-devices", 1500, 1000), "n-pcs": ("pcs", 1320, 1160),
    "n-ess": ("ess", 1500, 1160), "n-microgrid": ("microgrid", 1410, 1340),
    "n-modular": ("modular-substation", 1320, 1550), "n-railway": ("railway", 1500, 1550),
}

P, S = "power", "signal"
E = [
    # 본선: 발전 → 송전 → 변전 → 배전 → 수전 → 변압 → 저압 → 분전
    ("n-gen", "n-step-up", P, "발전전압"), ("n-step-up", "n-ehv-gis", P, "345kV"), ("n-ehv-gis", "n-tline", P, "345kV"),
    ("n-ehv-gis", "n-la-ehv", P, None), ("n-ehv-gis", "n-ct-ehv", P, None), ("n-ct-ehv", "n-relay-tx", S, None),
    ("n-tline", "n-hvdc", P, None), ("n-tline", "n-facts", P, None),
    ("n-tline", "n-gis154", P, "154kV"), ("n-gis154", "n-main-tr", P, "154kV"), ("n-gis154", "n-sas", S, None),
    ("n-main-tr", "n-fcl", P, "22.9kV"), ("n-fcl", "n-dline", P, "22.9kV"),
    ("n-dline", "n-recloser", P, "22.9kV"), ("n-recloser", "n-auto-sw", P, "22.9kV"), ("n-auto-sw", "n-pole-tr", P, "22.9kV"),
    ("n-dline", "n-lbs", P, "22.9kV"), ("n-lbs", "n-la", P, None), ("n-auto-sw", "n-alts", P, "22.9kV 예비"),
    ("n-alts", "n-mof", P, None), ("n-lbs", "n-mof", P, None), ("n-mof", "n-meter", S, None),
    ("n-mof", "n-vcb", P, None), ("n-vcb", "n-ct-pt", P, None), ("n-ct-pt", "n-relay", S, None), ("n-relay", "n-vcb", S, "트립"),
    ("n-vcb", "n-pf", P, None), ("n-vcb", "n-vc", P, None), ("n-vc", "n-mv-drive", P, "6.6kV"),
    ("n-vcb", "n-cast-tr", P, "22.9kV"), ("n-pf", "n-oil-tr", P, "22.9kV"),
    ("n-cast-tr", "n-acb", P, "380V"), ("n-oil-tr", "n-busway", P, "380V"),
    ("n-acb", "n-pmeter", S, None), ("n-acb", "n-mccb", P, None), ("n-acb", "n-busway", P, None),
    ("n-acb", "n-spd", P, None), ("n-acb", "n-cap", P, None), ("n-busway", "n-sag", P, None), ("n-sag", "n-aps", P, None),
    ("n-acb", "n-mcc", P, None), ("n-busway", "n-ats", P, None), ("n-egen", "n-ats", P, "비상"),
    ("n-mccb", "n-panel", P, "380/220V"), ("n-panel", "n-elcb", P, None), ("n-panel", "n-mcb", P, None),
    ("n-panel", "n-bmccb", P, None), ("n-elcb", "n-light", P, "220V"), ("n-mcb", "n-light", P, "220V"),
    ("n-bmccb", "n-evc", P, None), ("n-panel", "n-smart", S, None),
    ("n-mcc", "n-mms", P, None), ("n-mms", "n-ms", P, None), ("n-ms", "n-motor", P, None), ("n-empr", "n-ms", S, None),
    ("n-mcc", "n-drive", P, None), ("n-drive", "n-motor", P, None), ("n-mcc", "n-soft", P, None), ("n-soft", "n-motor", P, None),
    ("n-busway", "n-servo", P, None), ("n-mcc", "n-dmc", S, None),
    ("n-plc", "n-drive", S, None), ("n-plc", "n-servo", S, None), ("n-hmi", "n-plc", S, None),
    # 신재생 연계
    ("n-pv", "n-dc", P, "DC"), ("n-dc", "n-pcs", P, "DC"), ("n-ess", "n-pcs", P, "DC"), ("n-pcs", "n-acb", P, "380V 연계"),
    ("n-microgrid", "n-pcs", S, None),
    # 감시
    ("n-scada", "n-sas", S, None), ("n-dms", "n-auto-sw", S, None), ("n-dms", "n-recloser", S, None),
    ("n-amrs", "n-meter", S, None), ("n-scada", "n-relay", S, None), ("n-xems", "n-pmeter", S, None),
    ("n-care", "n-cast-tr", S, None), ("n-ems", "n-microgrid", S, None),
]


def main():
    ids = {e["id"] for e in EQUIPMENT}
    assert len(ids) == len(EQUIPMENT), "duplicate equipment id"
    layer_of = {e["id"]: e["layer"] for e in EQUIPMENT}
    band = {l["id"]: l for l in LAYERS}
    nodes = []
    for nid, (eid, x, y) in N.items():
        assert eid in ids, f"{nid}: unknown equipment {eid}"
        b = band[layer_of[eid]]
        assert b["x"] <= x <= b["x"] + b["width"] and b["y"] <= y <= b["y"] + b["height"], f"{nid} outside {b['id']}"
        nodes.append({"id": nid, "equipmentTypeId": eid, "x": x, "y": y})
    used = {n["equipmentTypeId"] for n in nodes}
    assert used == ids, f"equipment without node: {ids - used}"
    edges = []
    for i, (a, b, kind, v) in enumerate(E, 1):
        assert a in N and b in N, f"edge {a}->{b}"
        edge = {"id": f"e{i:03d}", "from": a, "to": b, "kind": kind}
        if v:
            edge["voltage"] = v
        edges.append(edge)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "equipment-types.json").write_text(json.dumps(EQUIPMENT, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    diagram = {"width": W, "height": H, "layers": LAYERS, "nodes": nodes, "edges": edges}
    (OUT / "diagram.json").write_text(json.dumps(diagram, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    from collections import Counter
    print(f"equipment {len(EQUIPMENT)}, nodes {len(nodes)}, edges {len(edges)}")
    print(Counter(e["coverage"] for e in EQUIPMENT))


if __name__ == "__main__":
    main()
