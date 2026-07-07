// constants/mapStyles.ts — Styles Google Maps uniques (light + dark).
// Source UNIQUE : avant, ces tableaux étaient copiés-collés dans 5 écrans avec
// deux palettes divergentes. Toute retouche se fait désormais ici, une seule fois.
// Palette monochrome alignée sur le design system (neutre chaud #F4F4F2 / #0A0A0A).

export const MAP_STYLE_LIGHT = [
  { elementType: 'geometry',           stylers: [{ color: '#F0F0F0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#F8F9FB' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#EFEFEF' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#E8E8E8' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#EBEBEB' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#DEDEDE' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#999999' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#FAFAFA' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#D1D5DB' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#E0E0E0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
];

export const MAP_STYLE_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#666666' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111111' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#151515' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#1C1C1C' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#222222' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#282828' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#232323' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0E0E0E' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#222222' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
];
