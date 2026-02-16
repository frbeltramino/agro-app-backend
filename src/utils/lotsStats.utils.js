export const emptyLot = (lot) => ({
  id: lot.id,
  lote: lot.name,
  superficieHa: Number(lot.hectares.toFixed(2)),
  cultivos: [],
});
