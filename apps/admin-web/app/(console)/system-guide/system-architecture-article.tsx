import { TreeStructure } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, InlineCode, ReferenceList } from "./guide-components";

export function SystemArchitectureArticle() {
  return (
    <GuideArticle
      id="system-architecture"
      number="01"
      eyebrow="系统架构"
      title="整个系统的架构"
      summary="EgoCapture 把业务控制面和视频数据面分开：两套 Web 应用负责身份、任务和审核，浏览器把视频直接传到私有对象存储。"
      statuses={["current", "boundary"]}
      icon={<TreeStructure className="size-6" weight="duotone" />}
    >
      <Conclusion>
        PostgreSQL 保存“谁、为哪个任务、在哪个 Session、上传了什么、如何判定”的业务权威；Storage 只保存私有对象字节。文件名、相机厂商 ID、二维码和 metadata 都是证据，不会反过来成为业务身份。
      </Conclusion>

      <GuideDiagram
        title="EgoCapture 当前系统架构"
        description="交互图展示 Admin、Participant、共享核心、PostgreSQL、TUS 数据面与后台处理边界。"
        src="/system-guide/diagrams/system-architecture.html"
      />

      <GuideSection title="两个产品界面，一套共享规则" eyebrow="Application boundary">
        <p><strong className="text-[var(--ink)]">Admin Web</strong> 面向运营和研究人员，负责参与者、任务版本、分配、上传状态、人工复核与审计；<strong className="text-[var(--ink)]">Participant Web</strong> 面向参与者，负责确认冻结任务、创建 Recording Session、展示签名 Marker、选择视频与恢复上传。</p>
        <p>两套 Next.js 应用共享 <InlineCode>packages/core</InlineCode> 的领域规则、服务与上传逻辑，以及 <InlineCode>packages/ui</InlineCode> 的视觉基础。它们不是通过复制业务判断保持一致，而是使用同一套核心合同。</p>
      </GuideSection>

      <FactGrid items={[
        { label: "控制面", value: <>Auth、JSON 命令、任务与审核进入 Next.js Route Handlers，再由 Core services 读写 PostgreSQL。</> },
        { label: "视频数据面", value: <>Participant 浏览器使用 <InlineCode>tus-js-client</InlineCode> 直传私有 Storage，视频字节不经过 Vercel Function。</> },
        { label: "身份与关联", value: <>Participant、TaskVersion、Assignment、RecordingSession 与 object key 都由服务端根据当前账号和业务状态推导。</> },
        { label: "后台推进", value: <>对象对账、轻量 metadata、Validation、Match、Review 与 Audit 逐层推进；任何单层成功都不能替代完整闭环。</> },
      ]} />

      <GuideSection title="权威链与证据链" eyebrow="Source of truth">
        <p className="rounded-2xl bg-[var(--ink)] px-4 py-4 font-mono text-xs leading-6 text-white/85 sm:px-5 sm:text-sm sm:leading-7">
          Participant → Assignment → immutable TaskVersion → Device → RecordingSession → UploadIntent / UploadAttempt → StoredObject → VideoAsset → ValidationRun → MatchDecision → ReviewCase / AuditEvent
        </p>
        <p>发布后的 TaskVersion、关键 Consent、MatchDecision 与 AuditEvent 按不可变或追加写模型保留。管理员纠正匹配时会新增决策并指向被替代的决策，不会覆盖历史。</p>
      </GuideSection>

      <GuideSection title="本页不能代表什么" eyebrow="Verified boundary">
        <p>当前仓库已完成 NAS 基础设施与 Mac 本地 Next.js 的真实浏览器闭环，但公网 Vercel/Supabase 部署仍是 <InlineCode>WAITING_EXTERNAL</InlineCode>。本地验收不等于公网可用性、生产容量或跨区域容灾证明。</p>
        <p>Multipart、直播、视频内二维码识别和自动内容判断均是未来能力；它们会沿用现有权威链，但本页不会把设计方案写成已经上线。</p>
      </GuideSection>

      <ReferenceList items={[
        { label: "README.md", note: "双应用、控制面/数据面与部署边界" },
        { label: "database/migrations/0001_core.sql", note: "核心业务实体、约束与不可变审计" },
        { label: "packages/core/src/server", note: "认证、数据库、Storage 与业务服务" },
      ]} />
    </GuideArticle>
  );
}
