/** Catálogo corto para filtros CRM / expedientes (entidad federativa MX). */
export const MEXICO_ENTITY_STATES: { code: string; label: string }[] = [
  { code: 'AGU', label: 'Aguascalientes' },
  { code: 'BCN', label: 'Baja California' },
  { code: 'BCS', label: 'Baja California Sur' },
  { code: 'CAM', label: 'Campeche' },
  { code: 'CHP', label: 'Chiapas' },
  { code: 'CHH', label: 'Chihuahua' },
  { code: 'CMX', label: 'Ciudad de México' },
  { code: 'COA', label: 'Coahuila' },
  { code: 'COL', label: 'Colima' },
  { code: 'DUR', label: 'Durango' },
  { code: 'GUA', label: 'Guanajuato' },
  { code: 'GRO', label: 'Guerrero' },
  { code: 'HID', label: 'Hidalgo' },
  { code: 'JAL', label: 'Jalisco' },
  { code: 'MEX', label: 'México' },
  { code: 'MIC', label: 'Michoacán' },
  { code: 'MOR', label: 'Morelos' },
  { code: 'NAY', label: 'Nayarit' },
  { code: 'NLE', label: 'Nuevo León' },
  { code: 'OAX', label: 'Oaxaca' },
  { code: 'PUE', label: 'Puebla' },
  { code: 'QUE', label: 'Querétaro' },
  { code: 'ROO', label: 'Quintana Roo' },
  { code: 'SLP', label: 'San Luis Potosí' },
  { code: 'SIN', label: 'Sinaloa' },
  { code: 'SON', label: 'Sonora' },
  { code: 'TAB', label: 'Tabasco' },
  { code: 'TAM', label: 'Tamaulipas' },
  { code: 'TLA', label: 'Tlaxcala' },
  { code: 'VER', label: 'Veracruz' },
  { code: 'YUC', label: 'Yucatán' },
  { code: 'ZAC', label: 'Zacatecas' },
];

export function entityLabelFromCode(code: string | null | undefined): string {
  if (!code) return '';
  const c = code.trim().toUpperCase();
  return MEXICO_ENTITY_STATES.find((e) => e.code === c)?.label ?? code;
}
