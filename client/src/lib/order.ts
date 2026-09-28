export function makeOrderId(randomValue = Math.random()) {
  return `INV-${101 + Math.floor(randomValue * 899)}`;
}

export function calculateOrderTotal(subtotal: number, delivery = 5000) {
  return subtotal + delivery;
}
