import { CloudArrowUp } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, ReferenceList, StepList } from "./guide-components";

export function ResumableUploadArticle() {
  return (
    <GuideArticle
      id="resumable-upload"
      number="03"
      eyebrow="大型文件上传"
      title="一个数 GB 视频如何分片、暂停并恢复"
      summary="用一个连续案例说明超大文件为什么不会因暂停、断网或刷新而从头重传，并明确区分当前 TUS 能力与未来生产级 Multipart 设计。"
      statuses={["current", "future", "boundary"]}
      icon={<CloudArrowUp className="size-6" weight="duotone" />}
    >
      <Conclusion tone="amber">
        超大文件不会从头重传，是因为系统把视频切成可独立确认的小段。网络恢复后，当前 TUS 从上传服务确认的字节位置继续；未来 Multipart 则核对已收到的分片，只补传缺失部分。浏览器记住的百分比只是提示，不能代替远端确认。
      </Conclusion>

      <GuideDiagram
        title="超大文件从初始化、恢复到完成的设计流程"
        description="展示暂停与取消的区别、刷新后如何找回同一上传，以及为什么恢复时只补传缺失分片。"
        src="/system-guide/diagrams/multipart-resume.html"
      />

      <GuideSection title="连续示例：第二天仍从已确认位置继续" eyebrow="未来生产体验">
        <p>
          假设参与者要上传一个数 GB 的原始视频。以下描述的是面向数 GB、弱网和跨天场景的目标体验，也是未来生产级 Multipart 方案需要实现的完整路径。
        </p>
        <StepList
          items={[
            {
              title: "选择原文件并建立上传会话",
              description: (
                <>
                  上传页面先记录文件名、大小、修改时间和稳定指纹，确认它属于哪一次采集，再建立一条可持续恢复的上传会话。视频字节直接发往上传服务，不经业务网页服务器中转。
                </>
              ),
            },
            {
              title: "切成分片，少量并发传输",
              description: (
                <>
                  文件被切成许多可独立重试的小段。上传器只同时发送少量分片，避免弱网下占满带宽和内存；每片成功后保存编号、大小和远端回执，未来方案再按供应商能力核对分片摘要。
                </>
              ),
            },
            {
              title: "只累计远端已经确认的进度",
              description: (
                <>
                  进度条只累计上传服务明确接收的字节或分片。某一片失败时只重试这一片；短时断网会停止继续调度并按节奏重试，不会让整个视频回到 0%。
                </>
              ),
            },
            {
              title: "暂停时保留继续资格",
              description: (
                <>
                  参与者点击暂停后不再发送新分片，但文件身份、上传会话和已确认分片仍保留。再次继续时，页面先向上传服务核对真实进度，再从确认位置接着传。
                </>
              ),
            },
            {
              title: "刷新或第二天重开后重新选择原文件",
              description: (
                <>
                  页面会找回“待继续”的上传卡片。浏览器出于文件权限保护，不能在参与者不知情时重新读取本地视频，因此参与者需要重新选择原文件；系统确认文件身份一致后才允许续传。
                </>
              ),
            },
            {
              title: "找回同一会话，只补传缺失分片",
              description: (
                <>
                  系统查询上传服务已收到的分片，并与本次上传记录对账。短期上传授权过期时，只为尚未完成的分片取得新授权；会话仍有效时，已经确认的分片无需重传。
                </>
              ),
            },
            {
              title: "合并、整体校验，再进入业务接受",
              description: (
                <>
                  所有分片到达后，上传服务按顺序合并并核对对象大小与完整性。进度达到 100% 只代表分片传送完毕；合并、文件与采集归属核验通过，并经管理员接受后，一次采集才完成。
                </>
              ),
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="刷新后恢复为什么可信" eyebrow="三个条件必须同时成立">
        <FactGrid
          items={[
            {
              label: "同一个原文件",
              value: "文件名、大小、修改时间和稳定指纹共同核对，防止把另一个视频续到旧上传里。",
            },
            {
              label: "同一个上传会话",
              value: "系统确认是谁在为哪次采集上传哪个文件，以及这次会话仍处于可继续状态。",
            },
            {
              label: "远端已收分片",
              value: "上传服务返回的已确认字节位置或分片清单，决定哪些内容无需重传。",
            },
            {
              label: "本地记录的角色",
              value: "本地缓存只帮助页面找回待恢复卡片，不能单方面宣布某个分片已经上传成功。",
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="看似相近，其实是不同结果" eyebrow="异常决策">
        <FactGrid
          items={[
            {
              label: "暂停",
              value: "稍后继续。停止发送新分片，但保留会话和已确认进度，继续时先与远端对账。",
            },
            {
              label: "取消",
              value: "放弃这次上传。终止继续资格、撤销恢复入口并安排清理残片；再次上传需要开启新会话。",
            },
            {
              label: "短期授权过期",
              value: "上传会话仍有效时，只为未完成分片补充新授权，已确认部分不需要重传。",
            },
            {
              label: "上传会话过期或被清理",
              value: "旧会话已不能继续，系统必须明确提示并开启新上传，不能伪装成从旧进度恢复。",
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="当前能做到什么，未来还要补什么" eyebrow="交付边界">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-200 bg-[var(--teal-soft)]/65 p-5">
            <p className="font-semibold text-[var(--ink)]">当前 MVP：TUS 受限恢复</p>
            <p className="mt-2 text-sm leading-7">
              当前路径支持分片直传、暂停、继续，以及刷新后找回待恢复任务并重新选择同一原文件。真实本地验收覆盖了一个超过单个 6 MiB 分片的小型测试视频、首片后暂停、找回原上传资源并继续。
            </p>
            <p className="mt-2 text-sm leading-7">
              当前单文件上限约 50 MB，单个 TUS 上传通道最长约 24 小时；验收没有证明完整 50 MB 边界，更没有证明数 GB、跨天、跨地区或生产云环境。
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/75 p-5">
            <p className="font-semibold text-[var(--ink)]">未来生产设计：持久化 Multipart</p>
            <p className="mt-2 text-sm leading-7">
              面向数 GB、弱网和跨天上传，未来方案将长期保留同一上传会话与分片回执，短期授权可以按缺失分片重新取得，并补齐合并、整体校验、取消和超期清理合同。
            </p>
            <p className="mt-2 text-sm leading-7">
              当前没有运行中的 S3 Multipart，也没有真实多 GB、跨天或异常清理压测；这些验证完成前，未来方案不能标记为已交付。
            </p>
          </div>
        </div>
      </GuideSection>

      <GuideSection title="生产落地需要守住的规则" eyebrow="如何实现">
        <ul className="list-disc space-y-2 ps-5 marker:text-[var(--signal)]">
          <li>按文件大小、供应商限制和单片重试成本选择分片大小，使用有界并发和带抖动的退避重试。</li>
          <li>只为本次上传的精确文件和分片发放短期权限，不把长期存储凭据交给参与者。</li>
          <li>恢复时以上传服务的确认结果为准；对账后再形成受控的完成清单，不能直接相信本地百分比。</li>
          <li>完成操作要允许安全重试，重复点击或重复回调应收敛到同一结果，不能生成两份业务素材。</li>
          <li>取消时主动终止并确认残片清理，后台再用超期清理和费用监控兜底。</li>
          <li>上线前用真实多 GB 文件覆盖弱网、跨天、授权过期、选错文件、合并失败和浏览器后台休眠。</li>
        </ul>
      </GuideSection>

      <ReferenceList items={[
        { label: "TUS resumable upload protocol", href: "https://tus.io/protocols/resumable-upload", note: "当前恢复位置与过期语义" },
        { label: "Supabase resumable uploads", href: "https://supabase.com/docs/guides/storage/uploads/resumable-uploads", note: "当前大文件直传与上传通道边界" },
        { label: "Amazon S3 Multipart upload overview", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html", note: "未来分片重试、合并与生命周期设计" },
        { label: "Amazon S3 object integrity", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html", note: "未来分片与整文件完整性核验" },
      ]} />
    </GuideArticle>
  );
}
