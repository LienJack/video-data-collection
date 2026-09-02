import { CloudArrowUp } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, InlineCode, ReferenceList, StepList } from "./guide-components";

export function ResumableUploadArticle() {
  return (
    <GuideArticle
      id="resumable-upload"
      number="03"
      eyebrow="大型文件上传"
      title="从当前 TUS 到跨天 Multipart"
      summary="当前实现已经支持分片、暂停、刷新后恢复和过期资源的显式处置；面向数十 GB、跨天和多云对象存储时，应演进为持久化 Multipart Upload Session。"
      statuses={["current", "future", "boundary"]}
      icon={<CloudArrowUp className="size-6" weight="duotone" />}
    >
      <Conclusion tone="amber">
        断点续传的关键不是“前端记住百分比”，而是服务端或对象存储保存已经确认的 offset/part。客户端缓存只负责找回同一个业务 Attempt 和远端上传资源，不能自行宣布某段字节已经成功。
      </Conclusion>

      <GuideSection title="当前实现：TUS 直传与受限恢复" eyebrow="Implemented now">
        <FactGrid items={[
          { label: "文件身份", value: <><InlineCode>fingerprint.worker.ts</InlineCode> 在 Web Worker 中计算采样指纹和完整 source SHA-256；恢复前核对文件名、大小与 SHA-256。</> },
          { label: "本地清单", value: <><InlineCode>persistence.ts</InlineCode> 使用带版本的 <InlineCode>localStorage</InlineCode> 记录 Upload/Attempt、object key、已确认字节、状态和过期时间。</> },
          { label: "恢复权威", value: <>TUS 服务端的 <InlineCode>Upload-Offset</InlineCode> 是真实进度；客户端通过稳定 fingerprint 找到 previous upload，再从服务端 offset 继续。</> },
          { label: "过期路径", value: <>资源返回 404/410 时不会在旧 Attempt 下静默从 0 新建；系统显式追加新的 Attempt，并保留失败历史。</> },
        ]} />
        <p>这条路径适合当前受 50 MB 上限保护的 MVP 暂停、恢复与浏览器演示；现有验收并没有覆盖完整 50 MB 边界。Supabase TUS upload URL 的研究边界约为 24 小时，因此不能承诺跨天持续复用同一上传 URL，也不能把现有整文件 SHA-256 方案直接外推到 50 GB。</p>
      </GuideSection>

      <GuideDiagram
        title="未来 Multipart 断点恢复时序"
        description="展示初始化、并发分片、暂停、以同一 uploadId 恢复、补签缺失分片、Complete 与服务端二次核验。"
        src="/system-guide/diagrams/multipart-resume.html"
      />

      <GuideSection title="未来方案：可恢复的 Multipart Upload Session" eyebrow="Reference design">
        <StepList items={[
          { title: "初始化并持久化合同", description: <>控制面先创建业务 UploadAttempt，再调用 <InlineCode>CreateMultipartUpload</InlineCode>。数据库保存 provider、region、uploadId、object key、分片大小和 checksum contract。</> },
          { title: "只签发当前需要的分片", description: <>客户端按 partNumber 请求短期 presigned URL，并以有界并发上传。每个成功回执持久化 size、ETag 与/或 checksum；重复上报按 Attempt + partNumber 幂等合并。</> },
          { title: "暂停后仍恢复同一会话", description: <>重新选择原文件并验证稳定 fingerprint；服务端用应用 manifest 对账 provider <InlineCode>ListParts</InlineCode>，只为缺失或未确认的 part 补签，不创建新的 multipart upload。</> },
          { title: "有序完成与二次核验", description: <><InlineCode>CompleteMultipartUpload</InlineCode> 使用应用持有的有序 manifest；随后以 HeadObject、provider receipt、对象大小与完整 checksum 对账，才登记 StoredObject/VideoAsset。</> },
          { title: "显式放弃与生命周期清理", description: <>取消或超期时执行 Abort；对象存储同时配置 AbortIncompleteMultipartUpload 生命周期规则，避免孤儿分片长期计费。</> },
        ]} />
        <p>多云边界由 Storage provider adapter 承担：业务会话保存 provider/region 与供应商回执，适配器分别实现 Create、List、Complete、Abort 和签名。不同供应商的 ETag、checksum、分片下限与一致性语义必须分别验证，不能假设“S3 兼容”就代表合同完全相同。</p>
      </GuideSection>

      <GuideSection title="上线前必须做的工程验证" eyebrow="Production gates">
        <ul className="list-disc space-y-2 ps-5 marker:text-[var(--signal)]">
          <li>把整文件一次性 hash 改为流式/分块计算，并在多 GB 文件、内存压力和后台标签页下验证。</li>
          <li>验证供应商对 checksum 算法、同 part 覆盖、ListParts 一致性和 Complete 重试的真实语义；Multipart ETag 不能当成稳定的整文件内容哈希。</li>
          <li>限制分片并发、带抖动退避与补签频率；签名只允许一个 UploadAttempt 的精确 object key 和 partNumber。</li>
          <li>实现会话 TTL、主动 Abort、生命周期清理、失败重试和费用监控，并验证幂等 Complete 不会生成重复业务资产。</li>
        </ul>
        <p>仓库 migration <InlineCode>0013_multipart_evolution_reservation.sql</InlineCode> 已预留 part manifest、completion receipt 和 multipart parts 表，但这只是兼容演进的数据合同，当前没有启用 S3 Multipart 运行时。</p>
      </GuideSection>

      <ReferenceList items={[
        { label: "TUS resumable upload protocol", href: "https://tus.io/protocols/resumable-upload", note: "offset 与恢复语义" },
        { label: "Supabase resumable uploads", href: "https://supabase.com/docs/guides/storage/uploads/resumable-uploads", note: "当前 Storage TUS 路径" },
        { label: "Amazon S3 Multipart upload overview", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html", note: "Multipart 生命周期与分片模型" },
        { label: "Amazon S3 object integrity", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html", note: "checksum 合同与完整性核验" },
        { label: "Amazon S3 CompleteMultipartUpload API", href: "https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html", note: "有序 manifest 与完成语义" },
        { label: "database/migrations/0013_multipart_evolution_reservation.sql", note: "尚未启用的演进预留" },
      ]} />
    </GuideArticle>
  );
}
