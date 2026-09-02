import { Broadcast } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, InlineCode, ReferenceList, StepList } from "./guide-components";

export function LiveCaptureArticle() {
  return (
    <GuideArticle
      id="live-capture"
      number="04"
      eyebrow="直播采集与归档"
      title="参与者推流，管理端如何保存视频"
      summary="未来直播能力应由参与者采集端推向专业直播服务，平台在服务端自动录制到私有对象存储；管理端观察和审核归档状态，而不是从播放器下载后再上传。"
      statuses={["future", "boundary"]}
      icon={<Broadcast className="size-6" weight="duotone" />}
    >
      <Conclusion tone="violet">
        建议以“内部 LiveCapture 权威 + 可替换直播供应商适配器”设计。AWS IVS Web Broadcast/RTMPS 与 Auto-record to S3 是一条具体参考路径，不是已经接入的能力，也不把 AWS Channel 或 recording ID 变成业务主键。
      </Conclusion>

      <GuideDiagram
        title="未来直播推流与服务端录制归档时序"
        description="从短期推流授权、参与者推流、平台自动录制，到 S3 归档、幂等事件回调、资产登记和 Admin 回看。"
        src="/system-guide/diagrams/live-recording.html"
      />

      <GuideSection title="推荐的端到端方案" eyebrow="AWS IVS reference path">
        <StepList items={[
          { title: "创建内部 LiveCapture", description: <>Participant 在已有 RecordingSession 下请求开播。控制面先创建内部记录，再由 provider adapter 分配 IVS Channel/Input；客户端只得到短期、范围受限的推流授权。</> },
          { title: "参与者采集端开始推流", description: <>浏览器或自研移动端优先使用 IVS Web Broadcast SDK；外部摄像机/编码器可走 RTMPS 等 ingest 适配。长期 AWS 凭据不会下发到客户端。</> },
          { title: "直播平台接收并服务端录制", description: <>IVS ingest 负责接收、转封装/分发；Auto-record to S3 把 HLS manifests、segments 和 recording metadata 写入系统控制的私有 bucket。</> },
          { title: "回调进入幂等事件收件箱", description: <>EventBridge/recording state change 先按 <InlineCode>provider + event_id</InlineCode> 去重，再以 Recording End/Failed 和 S3 metadata 对账。乱序或重复事件不能直接覆盖内部状态。</> },
          { title: "归档接入现有证据链", description: <>Worker 校验 bucket/prefix 与 RecordingSession，解析 provider metadata，登记 StoredObject/VideoAsset，并继续 Validation、Match 与 Review 流程。</> },
          { title: "Admin 查看状态与回放", description: <>管理端读取内部 LiveCapture/VideoAsset 状态，通过短期 signed playback URL 或受控 CDN 回看；读取、导出、保留与删除操作继续写入 AuditEvent。</> },
        ]} />
      </GuideSection>

      <FactGrid items={[
        { label: "推流与重连", value: <>客户端使用有界退避重连，并在同一内部 LiveCapture 的有限窗口内恢复；具体合并和录制间隙需生产 POC 验证。</> },
        { label: "录制与保存", value: <>保存发生在直播平台到私有对象存储的数据面。Admin 不接收整段直播字节，也不从播放器执行二次下载上传。</> },
        { label: "鉴权与轮换", value: <>推流授权短期、单 Session、可撤销；结束后停止 Input 并轮换/吊销广播密钥。页面、图表和日志不记录秘密。</> },
        { label: "供应商边界", value: <>Cloudflare Stream 或 Mux 可以替换 adapter，但录制格式、数据驻留、原片导出、回调、删除与价格合同必须分别验收。</> },
      ]} />

      <GuideSection title="失败恢复与治理重点" eyebrow="Operational safety">
        <ul className="list-disc space-y-2 ps-5 marker:text-[var(--signal)]">
          <li>把“推流中、录制中、归档中、已归档、失败”建模为内部状态；provider event 是需要对账的证据，不是数据库权威。</li>
          <li>Recording End 后读取 provider metadata 决定真实 playlist/rendition 路径，不能硬编码某个 HLS 文件名。</li>
          <li>对回调做签名/来源验证、去重、乱序容忍和定期补偿查询；录制失败或对象缺失必须进入 Review/运营告警。</li>
          <li>上线前独立验证 DPA、区域、编码兼容、断线缺口、回调延迟、原始媒体导出、删除回执、保留策略和单位成本。</li>
        </ul>
      </GuideSection>

      <ReferenceList items={[
        { label: "Amazon IVS Web Broadcast SDK guide", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-web.html", note: "浏览器采集与推流" },
        { label: "Amazon IVS Auto-record to S3", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html", note: "HLS、segments 与 recording metadata 归档" },
        { label: "Cloudflare Stream live inputs", href: "https://developers.cloudflare.com/stream/stream-live/", note: "候选 provider adapter" },
        { label: "Mux live streaming", href: "https://www.mux.com/docs/guides/start-live-streaming", note: "候选 provider adapter" },
        { label: "README.md", note: "当前直播能力为未实现的生产演进项" },
      ]} />
    </GuideArticle>
  );
}
