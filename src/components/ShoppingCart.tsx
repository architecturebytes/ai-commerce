import React from 'react';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface ShoppingCartProps {
  items: CartItem[];
  isOrderConfirmed: boolean;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ items, isOrderConfirmed }) => {
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);

  if (isOrderConfirmed) {
    return (
      <div className="shopping-cart-container">
        <h2>Shopping Cart</h2>
        <div className="order-confirmed">
          <h3>✓ Order Confirmed!</h3>
          <p>Thank you for your purchase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-cart-container">
      <h2>Shopping Cart</h2>
      {items.length === 0 ? (
        <p>Your cart is empty. Try saying "Add [product name] to the cart".</p>
      ) : (
        <>
          <ul className="cart-items-list">
            {items.map(item => (
              <li key={item.id} className="cart-item">
                <span className="cart-item-name">{item.name} (x{item.quantity})</span>
                <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            <strong>Total:</strong>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
          <p className="cart-checkout-prompt">Say "Checkout" to place your order.</p>
        </>
      )}
    </div>
  );
};

export default ShoppingCart;
