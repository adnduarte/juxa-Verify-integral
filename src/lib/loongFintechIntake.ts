/** Preguntas del filtro fintech (paso 1 intake vendedor). Todas deben cumplirse para avanzar. */
export type LoongFintechQuestion = {
  id: string;
  label: string;
  /** Si el valor debe ser true para pasar */
  expectTrue: boolean;
};

export const DEFAULT_LOONG_FINTECH_QUESTIONS: LoongFintechQuestion[] = [
  { id: 'mayor_edad', label: 'El prospecto declara ser mayor de 18 años.', expectTrue: true },
  { id: 'residente_mx', label: 'Reside en México y opera en territorio nacional.', expectTrue: true },
  { id: 'uso_legitimo', label: 'El crédito es para adquisición de motocicleta de uso personal o productivo declarado.', expectTrue: true },
  { id: 'sin_fraude', label: 'No hay indicios declarados de fraude o identidad falsa en esta captura.', expectTrue: true },
];

export const MEXICO_ENTIDADES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'México',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const;

export const INCOME_PROOF_OPTIONS = [
  'Recibos de nómina',
  'Estados de cuenta',
  'Declaración anual / opinión de cumplimiento',
  'Actividad independiente (facturas / ingresos declarados)',
  'Otro (detallar en notas)',
] as const;
