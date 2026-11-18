import { useEffect, useRef, useState } from 'react';
import { subscribeAnnounce } from '../../lib/announce';

/**
 * 앱 전체 상태 안내 영역 (B10) — AppLayout 에 하나만 둔다.
 * announce('공백 목록 9종') 를 받아 aria-live="polite" 로 읽어 준다. 같은 문장을 연달아 보내도 다시 읽히도록
 * 한 번 비웠다가 다음 프레임에 채운다.
 */
export default function LiveRegion() {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const unsubscribe = subscribeAnnounce((m) => {
      setMessage('');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(m), 50);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {message}
    </div>
  );
}
