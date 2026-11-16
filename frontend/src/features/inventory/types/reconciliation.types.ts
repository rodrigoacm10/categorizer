export interface ProductDiscrepancy {
  product_id: string;
  product_name: string;
  current_quantity: number;
  expected_quantity: number;
  difference: number;
  has_discrepancy: boolean;
}
