import Svg, { Line, Path, Rect } from 'react-native-svg';

/** A simple, traditional microphone glyph (SVG, not an emoji). */
export function MicIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2.5" width="6" height="11" rx="3" fill={color} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Line x1="12" y1="17.5" x2="12" y2="21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="8.5" y1="21" x2="15.5" y2="21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default MicIcon;
