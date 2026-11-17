import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LAYER_LABELS } from '../lib/schema';
import { useData } from '../data/load';
import EquipmentInfo from '../components/common/EquipmentInfo';
import NotFoundPage from './NotFoundPage';

export default function EquipmentPage() {
  const { id = '' } = useParams();
  const eq = useData().equipmentTypeById.get(id);

  useEffect(() => {
    if (eq) document.title = `${eq.name} · LS ELECTRIC 전력계통 제품맵`;
  }, [eq]);

  if (!eq) return <NotFoundPage kind="기기" id={id} />;

  return (
    <div className="page" data-testid="equipment-page">
      <h1 data-testid="equipment-title">{eq.name}</h1>
      <p className="page__lead">
        {eq.layer} {LAYER_LABELS[eq.layer]}
      </p>
      <EquipmentInfo eq={eq} idPrefix="equipment" />
      <p>
        <Link to="/">← 계통도로</Link>
      </p>
    </div>
  );
}
