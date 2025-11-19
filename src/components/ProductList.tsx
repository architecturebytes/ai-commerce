import React from 'react';
import { Product } from '../lib/data';
import ProductItem from './ProductItem';

interface ProductListProps {
  products: Product[];
}

const ProductList: React.FC<ProductListProps> = ({ products }) => {
  return (
    <div className="product-list-container">
      <h2>Products</h2>
      <div className="product-list">
        {products.map(product => (
          <ProductItem key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;
