import { FlowArrow } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, GuideArticle, GuideDiagram, GuideSection, InlineCode, ReferenceList, StepList } from "./guide-components";

export function SystemWorkflowArticle() {
  return (
    <GuideArticle
      id="system-workflow"
      number="02"
      eyebrow="双端联动"
      title="管理员与参与者如何完成一次采集"
      summary="管理员端定义并分配不可变任务，参与者端创建 Recording Session 并上传，后台形成证据，最后回到管理员端人工处置异常。"
      statuses={["current"]}
      icon={<FlowArrow className="size-6" weight="duotone" />}
    >
      <Conclusion>
        两套系统的联动不是“管理员发一个文件、参与者再上传一个文件”这么简单。Assignment 与冻结的 TaskVersion 先建立业务上下文，Recording Session 再绑定设备和采集事实，上传、核验、匹配与审核都沿这条上下文推进。
      </Conclusion>

      <GuideDiagram
        title="Admin 与 Participant 端到端协作时序"
        description="从任务发布、参与者确认、Session、TUS 直传，到核验、人工复核和 Audit 的完整联动。"
        src="/system-guide/diagrams/system-workflow.html"
      />

      <GuideSection title="一次采集的六个阶段" eyebrow="End-to-end flow">
        <StepList items={[
          { title: "管理员发布任务并分配参与者", description: <>Admin 创建结构化任务，发布后生成不可变 <InlineCode>TaskVersion</InlineCode> 与 content hash，再把指定 Participant 分配到 Assignment。</> },
          { title: "参与者确认冻结说明", description: <>Participant 登录后读取 Assignment 对应的完整任务版本，确认后进入采集准备；客户端不能自行更换 Participant 或 TaskVersion。</> },
          { title: "创建 Recording Session", description: <>Participant 选择已登记设备，创建绑定 Assignment/Device 的 Session，展示并确认 Ed25519 签名 Marker。视频仍由外部设备录制。</> },
          { title: "选择 Session 并直传视频", description: <>录制结束后，参与者手动选择对应 Session，创建 UploadIntent/UploadAttempt；浏览器通过 TUS 把字节直接传到私有 Storage。</> },
          { title: "后台核验并形成匹配证据", description: <>Complete 触发对象存在/大小对账与轻量 metadata，系统产生 StoredObject、VideoAsset、ValidationRun 与 MatchDecision；异常进入 ReviewCase。</> },
          { title: "管理员复核并保留审计", description: <>Admin 确认、纠正、拒绝或要求重录。纠正会新增 superseding MatchDecision，所有关键动作都追加 AuditEvent。</> },
        ]} />
      </GuideSection>

      <GuideSection title="关键联动规则" eyebrow="Coordination rules">
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4"><strong className="block text-[var(--ink)]">版本先冻结</strong>参与者看到的是 Assignment 指向的发布版本，不是管理员仍可编辑的草稿。</li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4"><strong className="block text-[var(--ink)]">Session 先于上传</strong>Marker 证明采集上下文；MVP 上传时仍由参与者人工选择 Session，不自动识别视频二维码。</li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4"><strong className="block text-[var(--ink)]">Storage 成功不是业务完成</strong>TUS 完成只说明资源传输结束；对象、大小、身份与匹配仍需控制面核验。</li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4"><strong className="block text-[var(--ink)]">异常进入人工闭环</strong>metadata 缺失、设备不一致或重复候选不会静默覆盖关系，而是形成 ReviewCase。</li>
        </ul>
      </GuideSection>

      <ReferenceList items={[
        { label: "database/migrations/0001_core.sql", note: "Assignment、Session、Upload、Match、Review 与 Audit 权威链" },
        { label: "packages/core/src/server/services/tasks.ts", note: "任务版本与分配规则" },
        { label: "packages/core/src/server/services/sessions.ts", note: "Recording Session 与 Marker" },
        { label: "packages/core/src/server/services/uploads.ts", note: "上传、对账和资产登记" },
      ]} />
    </GuideArticle>
  );
}
