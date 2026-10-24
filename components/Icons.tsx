import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'die'
  | 'sliders'
  | 'map'
  | 'undo'
  | 'close'
  | 'back'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'poster'
  | 'quiet'
  | 'story'
  | 'feed'
  | 'square';

export function Icon({
  name,
  size = 22,
  color = '#1c1b19',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const stroke = { stroke: color, strokeWidth: 1.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'die' && (
        <>
          <Rect x="4.5" y="4.5" width="15" height="15" rx="3.2" {...stroke} />
          <Circle cx="8.5" cy="8.5" r="0.9" fill={color} />
          <Circle cx="15.5" cy="8.5" r="0.9" fill={color} />
          <Circle cx="12" cy="12" r="0.9" fill={color} />
          <Circle cx="8.5" cy="15.5" r="0.9" fill={color} />
          <Circle cx="15.5" cy="15.5" r="0.9" fill={color} />
        </>
      )}
      {name === 'sliders' && (
        <>
          <Line x1="4" y1="8" x2="20" y2="8" {...stroke} />
          <Line x1="4" y1="16" x2="20" y2="16" {...stroke} />
          <Circle cx="9" cy="8" r="2" fill="#f3f0ea" stroke={color} strokeWidth={1.25} />
          <Circle cx="15" cy="16" r="2" fill="#f3f0ea" stroke={color} strokeWidth={1.25} />
        </>
      )}
      {name === 'map' && (
        <>
          <Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" {...stroke} />
          <Circle cx="12" cy="11" r="1.7" {...stroke} />
        </>
      )}
      {name === 'undo' && <Path d="M8 8H4.5V4.5M5 8a7 7 0 1 1-1.2 4" {...stroke} />}
      {name === 'close' && (
        <>
          <Path d="M7 7l10 10" {...stroke} />
          <Path d="M17 7 7 17" {...stroke} />
        </>
      )}
      {name === 'back' && <Path d="M14.5 6 8.5 12l6 6" {...stroke} />}
      {name === 'align-left' && (
        <>
          <Line x1="5" y1="7" x2="16" y2="7" {...stroke} />
          <Line x1="5" y1="12" x2="19" y2="12" {...stroke} />
          <Line x1="5" y1="17" x2="13" y2="17" {...stroke} />
        </>
      )}
      {name === 'align-center' && (
        <>
          <Line x1="7" y1="7" x2="17" y2="7" {...stroke} />
          <Line x1="5" y1="12" x2="19" y2="12" {...stroke} />
          <Line x1="8" y1="17" x2="16" y2="17" {...stroke} />
        </>
      )}
      {name === 'align-right' && (
        <>
          <Line x1="8" y1="7" x2="19" y2="7" {...stroke} />
          <Line x1="5" y1="12" x2="19" y2="12" {...stroke} />
          <Line x1="11" y1="17" x2="19" y2="17" {...stroke} />
        </>
      )}
      {name === 'poster' && (
        <>
          <Line x1="5" y1="7" x2="19" y2="7" {...stroke} />
          <Line x1="5" y1="11" x2="19" y2="11" {...stroke} />
          <Line x1="5" y1="15" x2="19" y2="15" {...stroke} />
          <Line x1="5" y1="19" x2="12" y2="19" {...stroke} />
        </>
      )}
      {name === 'quiet' && (
        <>
          <Line x1="8" y1="8" x2="16" y2="8" {...stroke} />
          <Line x1="6" y1="12" x2="18" y2="12" {...stroke} />
          <Line x1="9" y1="16" x2="15" y2="16" {...stroke} />
        </>
      )}
      {name === 'story' && <Rect x="8" y="3.5" width="8" height="17" rx="1.4" {...stroke} />}
      {name === 'feed' && <Rect x="6.5" y="4" width="11" height="16" rx="1.4" {...stroke} />}
      {name === 'square' && <Rect x="5" y="5" width="14" height="14" rx="1.4" {...stroke} />}
    </Svg>
  );
}
