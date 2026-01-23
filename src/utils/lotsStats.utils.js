export const emptyLot = (lot) => ({
  id: lot.id,
  lote: lot.name,
  superficieHa: Number(lot.hectares),
  insumos: 0,
  labores: 0,
  cosecha: 0,
  costoVariable: 0,
  margenBruto: 0,
});
