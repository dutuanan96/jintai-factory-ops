import type { Metadata } from "next";
import { FactoryOpsApp } from "./FactoryOpsApp";

export const metadata: Metadata = {
  title: "JinTai FactoryOps | 金汰工厂运营管理系统",
  description: "生产计划、MRP、采购、仓库、生产入库与出货一体化管理",
};

export default function Home() {
  return <FactoryOpsApp />;
}
