"use client";

import { useMemo, useState } from "react";

type ModuleId = "dashboard" | "planning" | "mrp" | "purchasing" | "rawWarehouse" | "production" | "finishedGoods" | "shipping" | "pdmSync";

interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: string;
  count?: number;
}

interface ProductionOrder {
  code: string;
  sku: string;
  quantity: number;
  dueDate: string;
  revision: string;
  progress: number;
  status: "已发布" | "生产中" | "部分完成" | "待物料";
}

const modules: ModuleDefinition[] = [
  { id: "dashboard", label: "运营看板", icon: "dashboard" },
  { id: "planning", label: "生产计划", icon: "calendar_month", count: 12 },
  { id: "mrp", label: "物料需求 MRP", icon: "account_tree", count: 8 },
  { id: "purchasing", label: "采购管理", icon: "shopping_cart", count: 5 },
  { id: "rawWarehouse", label: "原料仓库", icon: "inventory_2" },
  { id: "production", label: "生产执行", icon: "precision_manufacturing", count: 7 },
  { id: "finishedGoods", label: "成品仓库", icon: "warehouse" },
  { id: "shipping", label: "出货管理", icon: "local_shipping", count: 4 },
  { id: "pdmSync", label: "PDM 数据同步", icon: "sync" },
];

const productionOrders: ProductionOrder[] = [
  { code: "MO-2608-0041", sku: "LGS131B101V1S", quantity: 1640, dueDate: "08-15", revision: "V3", progress: 78, status: "生产中" },
  { code: "MO-2608-0042", sku: "LGS723BH02S", quantity: 850, dueDate: "08-16", revision: "V2", progress: 100, status: "已发布" },
  { code: "MO-2608-0043", sku: "LGS032B101S", quantity: 1181, dueDate: "08-18", revision: "V3.1", progress: 46, status: "部分完成" },
  { code: "MO-2608-0044", sku: "LGS233KD02S", quantity: 1243, dueDate: "08-20", revision: "V1", progress: 18, status: "待物料" },
  { code: "MO-2608-0045", sku: "LGS834BH02S", quantity: 986, dueDate: "08-21", revision: "V2", progress: 61, status: "生产中" },
];

const shortages = [
  { code: "LGS233DB101KD", name: "LGS233 顶板", required: 2486, available: 910, inbound: 500, shortage: 1076, needBy: "08-14" },
  { code: "NLPLS6022BZ", name: "M6x22 内六角螺丝", required: 32800, available: 16400, inbound: 8000, shortage: 8400, needBy: "08-15" },
  { code: "BC350327187BH", name: "350 布抽", required: 3280, available: 1820, inbound: 600, shortage: 860, needBy: "08-16" },
  { code: "LGS032PKXBH", name: "LGS032 平口箱", required: 1181, available: 620, inbound: 0, shortage: 561, needBy: "08-17" },
];

const purchaseOrders = [
  { code: "PO-2608-0188", supplier: "金鸣五金", lines: 12, amount: "¥ 86,420", eta: "08-14", status: "部分到货" },
  { code: "PO-2608-0191", supplier: "美迪包装", lines: 8, amount: "¥ 42,760", eta: "08-16", status: "已下单" },
  { code: "PO-2608-0194", supplier: "二厂郭", lines: 6, amount: "¥ 128,300", eta: "08-18", status: "待确认" },
];

const shipments = [
  { code: "DO-2608-0092", customer: "Amazon UK", sku: "LGS131B101V1S", planned: 1640, shipped: 1000, date: "08-15", status: "部分出货" },
  { code: "DO-2608-0093", customer: "Amazon US", sku: "LGS723BH02S", planned: 850, shipped: 850, date: "08-16", status: "已完成" },
  { code: "DO-2608-0094", customer: "Wayfair", sku: "LGS032B101S", planned: 1181, shipped: 0, date: "08-18", status: "待备货" },
];

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("完成") || status.includes("到货") ? "success" : status.includes("待") ? "warning" : "info";
  return <span className={`status-badge ${tone}`}>{status}</span>;
}

function MetricCard({ icon, label, value, note, tone = "blue" }: { icon: string; label: string; value: string; note: string; tone?: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><span className="material-symbols-outlined">{icon}</span></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function Dashboard() {
  return <>
    <PageHeading eyebrow="今日运营概览" title="工厂运营看板" subtitle="生产、物料、采购、库存与出货的统一视图" action="新建生产计划" />
    <section className="metrics-grid">
      <MetricCard icon="assignment" label="进行中生产单" value="12" note="3 单存在风险" />
      <MetricCard icon="warning" label="缺料项目" value="8" note="4 项需要今日下单" tone="orange" />
      <MetricCard icon="inventory" label="待入库采购" value="5" note="2 单预计今日到货" tone="purple" />
      <MetricCard icon="local_shipping" label="本周待出货" value="4,912" note="共 9 个 SKU" tone="green" />
    </section>
    <section className="dashboard-grid">
      <div className="panel">
        <PanelHeader title="生产计划进度" subtitle="按计划交期排序" />
        <ProductionOrdersTable rows={productionOrders} />
      </div>
      <div className="panel">
        <div className="panel-header"><div><h2>今日风险</h2><p>需要立即处理</p></div><span className="alert-count">4</span></div>
        <div className="risk-list">
          <RiskItem tone="critical" icon="error" title="MO-2608-0044 缺少关键板材" detail="预计影响交期 2 天" />
          <RiskItem tone="warning" icon="schedule" title="PO-2608-0188 部分延迟" detail="金鸣五金确认晚到 1 天" />
          <RiskItem tone="warning" icon="inventory_2" title="成品库存接近下限" detail="LGS032B101S 仅剩 42 件" />
          <RiskItem tone="info" icon="sync_problem" title="PDM 有新版本" detail="2 个产品 revision 待同步" />
        </div>
      </div>
    </section>
    <div className="panel"><PanelHeader title="物料缺口 Top 4" subtitle="已扣除可用库存与确认在途数量" action="生成采购建议" /><ShortageTable /></div>
  </>;
}

function PageHeading({ eyebrow = "FactoryOps", title, subtitle, action, onAction, actionIcon = "add" }: { eyebrow?: string; title: string; subtitle: string; action?: string; onAction?: () => void; actionIcon?: string }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action ? <button className="btn primary" type="button" onClick={onAction}><span className="material-symbols-outlined">{actionIcon}</span>{action}</button> : null}</div>;
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action ? <button className="btn small">{action}</button> : <button className="text-btn">查看全部 <span className="material-symbols-outlined">arrow_forward</span></button>}</div>;
}

function RiskItem({ tone, icon, title, detail }: { tone: string; icon: string; title: string; detail: string }) {
  return <div className={`risk-item ${tone}`}><span className="material-symbols-outlined">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

function ProductionOrdersTable({ rows }: { rows: ProductionOrder[] }) {
  return <div className="table-scroll"><table><thead><tr><th>生产单号</th><th>SKU</th><th>计划数量</th><th>交期</th><th>BOM</th><th>进度</th><th>状态</th></tr></thead><tbody>{rows.map((order) => <tr key={order.code}><td className="mono strong">{order.code}</td><td className="mono">{order.sku}</td><td>{order.quantity.toLocaleString()}</td><td>{order.dueDate}</td><td><span className="revision-tag">{order.revision}</span></td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${order.progress}%` }} /></div><small>{order.progress}%</small></div></td><td><StatusBadge status={order.status} /></td></tr>)}</tbody></table></div>;
}

function ShortageTable() {
  return <div className="table-scroll"><table><thead><tr><th>物料编码</th><th>物料名称</th><th>总需求</th><th>可用库存</th><th>确认在途</th><th>净缺口</th><th>需求日期</th></tr></thead><tbody>{shortages.map((item) => <tr key={item.code}><td className="mono strong">{item.code}</td><td>{item.name}</td><td>{item.required.toLocaleString()}</td><td>{item.available.toLocaleString()}</td><td>{item.inbound.toLocaleString()}</td><td className="negative strong">-{item.shortage.toLocaleString()}</td><td>{item.needBy}</td></tr>)}</tbody></table></div>;
}

function ModuleShell({ title, subtitle, action, children }: { title: string; subtitle: string; action: string; children: React.ReactNode }) {
  return <><PageHeading title={title} subtitle={subtitle} action={action} /><section className="panel"><div className="panel-header toolbar"><div className="search-box"><span className="material-symbols-outlined">search</span><input aria-label={`搜索${title}`} placeholder={`搜索${title}...`} /></div><div className="filter-actions"><button className="btn small"><span className="material-symbols-outlined">filter_list</span>筛选</button><button className="btn small"><span className="material-symbols-outlined">download</span>导出</button></div></div><div className="table-scroll">{children}</div></section></>;
}

function PlanningView() {
  return <ModuleShell title="生产计划" subtitle="由 PM 创建、审核并发布生产单；发布时冻结 PDM BOM 快照。" action="新建生产计划"><ProductionOrdersTable rows={productionOrders} /></ModuleShell>;
}

function MrpView() {
  return <ModuleShell title="物料需求 MRP" subtitle="净需求 = BOM 总需求 - 可用库存 - 确认在途；所有建议可追溯到生产单。" action="重新计算 MRP"><ShortageTable /></ModuleShell>;
}

function PurchasingView() {
  return <ModuleShell title="采购管理" subtitle="从已审批的物料需求创建采购单，支持合并采购与分批到货。" action="新建采购单"><table><thead><tr><th>采购单号</th><th>供应商</th><th>物料行数</th><th>订单金额</th><th>预计到货</th><th>状态</th></tr></thead><tbody>{purchaseOrders.map((order) => <tr key={order.code}><td className="mono strong">{order.code}</td><td>{order.supplier}</td><td>{order.lines}</td><td>{order.amount}</td><td>{order.eta}</td><td><StatusBadge status={order.status} /></td></tr>)}</tbody></table></ModuleShell>;
}

function WarehouseView({ finished = false }: { finished?: boolean }) {
  const rows = finished ? [["LGS131B101V1S", "成品仓 A-01", "1,240", "640", "600"], ["LGS723BH02S", "成品仓 A-03", "850", "850", "0"], ["LGS032B101S", "成品仓 B-02", "42", "0", "42"]] : [["LGS233DB101KD", "原料仓 A-12", "910", "780", "130"], ["NLPLS6022BZ", "五金仓 C-08", "16,400", "12,200", "4,200"], ["BC350327187BH", "布抽仓 B-16", "1,820", "1,100", "720"]];
  return <ModuleShell title={finished ? "成品仓库" : "原料仓库"} subtitle="库存余额由已过账的业务凭证计算，禁止直接修改。" action={finished ? "成品入库" : "采购收货"}><table><thead><tr><th>物料 / SKU</th><th>库位</th><th>账面库存</th><th>已预留</th><th>可用库存</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={index === 0 ? "mono strong" : ""}>{cell}</td>)}</tr>)}</tbody></table></ModuleShell>;
}

function ProductionView() {
  return <ModuleShell title="生产执行" subtitle="按生产单领料、退料、报告完成数量及损耗，并保留完整记录。" action="报告生产完成"><table><thead><tr><th>生产单号</th><th>SKU</th><th>计划</th><th>已完成</th><th>待完成</th><th>当前状态</th></tr></thead><tbody>{productionOrders.slice(0, 4).map((order) => { const completed = Math.round(order.quantity * order.progress / 100); return <tr key={order.code}><td className="mono strong">{order.code}</td><td className="mono">{order.sku}</td><td>{order.quantity.toLocaleString()}</td><td>{completed.toLocaleString()}</td><td>{(order.quantity - completed).toLocaleString()}</td><td><StatusBadge status={order.status} /></td></tr>; })}</tbody></table></ModuleShell>;
}

function ShippingView() {
  return <ModuleShell title="出货管理" subtitle="根据客户交付计划备货与出货，禁止超过订单数量或成品可用库存。" action="新建出货单"><table><thead><tr><th>出货单号</th><th>客户</th><th>SKU</th><th>计划数量</th><th>已出货</th><th>交期</th><th>状态</th></tr></thead><tbody>{shipments.map((row) => <tr key={row.code}><td className="mono strong">{row.code}</td><td>{row.customer}</td><td className="mono">{row.sku}</td><td>{row.planned.toLocaleString()}</td><td>{row.shipped.toLocaleString()}</td><td>{row.date}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></ModuleShell>;
}

interface PdmSyncResult {
  status: "APPLIED";
  sourceCommitSha: string;
  sourceUpdatedAt: string | null;
  shardCount: number;
  productCount: number;
  materialCount: number;
  bomLineCount: number;
}

function PdmSyncView() {
  const [result, setResult] = useState<PdmSyncResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const syncPdm = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const response = await fetch("/api/pdm/sync", { method: "POST" });
      const payload = await response.json() as PdmSyncResult | { error?: string };
      if (!response.ok || !("status" in payload) || payload.status !== "APPLIED") throw new Error("error" in payload ? payload.error : "PDM_SYNC_FAILED");
      setResult(payload);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "PDM_SYNC_FAILED");
    } finally {
      setSyncing(false);
    }
  };
  return <><PageHeading eyebrow="只读集成" title="PDM 数据同步" subtitle="FactoryOps 仅从 PDM 获取已发布产品、SKU、BOM 与 revision，不包含任何写回权限。" action={syncing ? "同步中..." : "立即同步"} actionIcon="sync" onAction={() => { if (!syncing) void syncPdm(); }} /><section className="sync-guard"><div className="guard-icon"><span className="material-symbols-outlined">lock</span></div><div><strong>只读安全边界已启用</strong><p>连接器仅使用 GET 请求读取 PDM 的 commit-pinned 数据分片。生产、采购、库存与出货数据全部保存在 FactoryOps 独立数据库中。</p></div><span className="status-badge success">READ ONLY</span></section><section className="panel"><PanelHeader title="同步状态" subtitle="来源：dutuanan96/bom-viewer-sync · main · bom-viewer-sync/data" /><div className="sync-detail-grid"><div><span>最后同步</span><strong>{result?.sourceUpdatedAt ?? "尚未同步"}</strong></div><div><span>来源 Commit</span><strong className="mono">{result?.sourceCommitSha.slice(0, 12) ?? "-"}</strong></div><div><span>产品</span><strong>{result?.productCount ?? "-"}</strong></div><div><span>数据分片</span><strong>{result ? `${result.shardCount} / ${result.shardCount}` : "-"}</strong></div><div><span>同步结果</span><strong className={result ? "positive" : "warning-text"}>{result ? "完整且有效" : "等待同步"}</strong></div><div><span>BOM 行</span><strong>{result?.bomLineCount?.toLocaleString() ?? "-"}</strong></div></div>{syncError ? <p className="negative">同步失败：{syncError}</p> : null}</section></>;
}

export function FactoryOpsApp() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeLabel = useMemo(() => modules.find((item) => item.id === activeModule)?.label ?? "运营看板", [activeModule]);
  const content = activeModule === "dashboard" ? <Dashboard /> : activeModule === "planning" ? <PlanningView /> : activeModule === "mrp" ? <MrpView /> : activeModule === "purchasing" ? <PurchasingView /> : activeModule === "rawWarehouse" ? <WarehouseView /> : activeModule === "production" ? <ProductionView /> : activeModule === "finishedGoods" ? <WarehouseView finished /> : activeModule === "shipping" ? <ShippingView /> : <PdmSyncView />;

  return <div className="factory-shell"><aside className={`sidebar ${sidebarOpen ? "open" : ""}`}><div className="brand"><div className="brand-logo" role="img" aria-label="金汰家具标志" /><div><strong className="brand-title">金汰家具</strong><span className="brand-subtitle">工厂运营管理系统</span><small className="brand-version">FactoryOps · V0.1</small></div></div><div className="sidebar-section-label">工厂运营</div><nav>{modules.map((item) => <button key={item.id} type="button" className={activeModule === item.id ? "active" : ""} onClick={() => { setActiveModule(item.id); setSidebarOpen(false); }}><span className="material-symbols-outlined">{item.icon}</span><span>{item.label}</span>{item.count ? <b>{item.count}</b> : null}</button>)}</nav><div className="sidebar-footer-spacer" /><div className="sidebar-credit">Developed by 俞俊安</div><div className="sidebar-divider" /><button className="sidebar-bottom"><span className="material-symbols-outlined">settings</span>系统设置</button></aside><div className="app-frame"><header className="topbar"><button className="mobile-menu" type="button" aria-label="打开导航" onClick={() => setSidebarOpen(!sidebarOpen)}><span className="material-symbols-outlined">menu</span></button><div className="breadcrumb"><span>FactoryOps</span><span>/</span><strong>{activeLabel}</strong></div><div className="top-search"><span className="material-symbols-outlined">search</span><input aria-label="全局搜索" placeholder="搜索订单、SKU、物料..." /></div><button className="icon-button" aria-label="通知"><span className="material-symbols-outlined">notifications</span><i /></button><div className="sync-chip"><span /><div><small>PDM 同步</small><strong>正常</strong></div></div><button className="user-menu"><span>张</span><div><strong>张计划</strong><small>生产计划员</small></div><span className="material-symbols-outlined">expand_more</span></button></header><main>{content}</main></div>{sidebarOpen ? <button className="sidebar-backdrop" aria-label="关闭导航" onClick={() => setSidebarOpen(false)} /> : null}</div>;
}
