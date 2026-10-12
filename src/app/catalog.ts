// Машины CarX Drift Racing Online 2 — со скриншотов гаража от организатора (по маркам, по алфавиту)
export const CARS = [
  'BNM 30E', 'BNM 36E', 'BNM B46', 'BNM BM2', 'BNM M4R', 'BNM M92',
  'Covert CC6', 'Covert CMR19', 'Covert CMR70',
  'Dole M8R',
  "Joe's MST20", "Joe's MST90",
  'Kyoto E86', 'Kyoto G86', 'Kyoto R86', 'Kyoto S80', 'Kyoto S90', 'Kyoto SRR', 'Kyoto TC100', 'Kyoto TM28', 'Kyoto XS100', 'Kyoto YSR',
  'Nishimo 30S', 'Nishimo 32R', 'Nishimo 34R', 'Nishimo 35R', 'Nishimo LRL33', 'Nishimo LRL35', 'Nishimo S18', 'Nishimo SI3', 'Nishimo SI4', 'Nishimo SI5', 'Nishimo Z37', 'Nishimo Z40',
  'Vankel R7D',
];

// Двигатели и коробки — со скриншотов меню свапа, в том же порядке, что в игре
export const ENGINES = ['A4EG', 'RS20', 'L3S', 'J2Z', 'BR26', 'RV38', 'R13'];

export const GEARBOXES = ['F5S', '158R', 'GT-rag 160v', 'Evy SL', 'Supersonic v1', 'Supersonic v2'];

/** Реальные прототипы машин — подсказка в выборе машины и в профиле (сверено организатором) */
export const CAR_PROTOTYPES: Record<string, string> = {
  'BNM 30E': 'BMW M3 E30',
  'BNM 36E': 'BMW M3 E36',
  'BNM B46': 'BMW M3 E46',
  'BNM M92': 'BMW M3 E92',
  'BNM BM2': 'BMW M2 F87',
  'BNM M4R': 'BMW M4 G82',
  'Covert CMR70': 'Chevrolet Camaro 1970',
  'Covert CMR19': 'Chevrolet Camaro 2019',
  'Covert CC6': 'Chevrolet Corvette C6',
  'Dole M8R': 'HSV Maloo R8',
  "Joe's MST90": 'Ford Mustang Fox Body',
  "Joe's MST20": 'Ford Mustang GT S550',
  'Kyoto E86': 'Toyota Sprinter Trueno AE86',
  'Kyoto G86': 'Toyota GT86',
  'Kyoto R86': 'Toyota GR86',
  'Kyoto S80': 'Toyota Supra A80',
  'Kyoto S90': 'Toyota GR Supra A90',
  'Kyoto SRR': 'Toyota Soarer Z30',
  'Kyoto TM28': 'Toyota Mark II X80',
  'Kyoto TC100': 'Toyota Chaser JZX100',
  'Kyoto XS100': 'Toyota Altezza / Lexus IS300',
  'Kyoto YSR': 'Toyota GR Yaris',
  'Nishimo 30S': 'Nissan Fairlady Z S30',
  'Nishimo 32R': 'Nissan Skyline GT-R R32',
  'Nishimo 34R': 'Nissan Skyline GT-R R34',
  'Nishimo 35R': 'Nissan GT-R R35',
  'Nishimo LRL33': 'Nissan Laurel C33',
  'Nishimo LRL35': 'Nissan Laurel C35',
  'Nishimo S18': 'Nissan 180SX',
  'Nishimo SI3': 'Nissan Silvia S13',
  'Nishimo SI4': 'Nissan Silvia S14',
  'Nishimo SI5': 'Nissan Silvia S15',
  'Nishimo Z37': 'Nissan 370Z',
  'Nishimo Z40': 'Nissan Z RZ34',
  'Vankel R7D': 'Mazda RX-7 FD3S',
};
