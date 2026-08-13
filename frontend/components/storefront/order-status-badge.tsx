import type { OrderStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";

const LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待支付", PAID: "已支付", SHIPPED: "已发货", COMPLETED: "已完成",
  CLOSED: "已关闭", REFUNDING: "退款中", REFUNDED: "已退款",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant="outline">{LABEL[status]}</Badge>;
}
