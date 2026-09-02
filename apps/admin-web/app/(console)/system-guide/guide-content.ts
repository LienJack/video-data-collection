import type { UiLocale } from "@egocapture/core/i18n";

export type GuideStatus = "current" | "future" | "boundary";

export type GuideArticleContent = {
  eyebrow: string;
  title: string;
  summary: string;
  conclusion: string;
  diagramTitle: string;
  diagramDescription: string;
  sections: Array<{
    eyebrow: string;
    title: string;
    paragraphs?: string[];
    steps?: Array<{ title: string; description: string }>;
    facts?: Array<{ label: string; value: string }>;
  }>;
  references?: Array<{ label: string; href?: string; note?: string }>;
};

export type GuidePageContent = {
  metadataTitle: string;
  metadataDescription: string;
  kicker: string;
  releaseLabel: string;
  title: string;
  intro: string;
  evidenceLabel: string;
  futureLabel: string;
  noPromiseLabel: string;
  contentsLabel: string;
  conclusionLabel: string;
  openDiagramLabel: string;
  referencesLabel: string;
  newTabLabel: string;
  statusLabels: Record<GuideStatus, string>;
  articles: {
    architecture: GuideArticleContent;
    workflow: GuideArticleContent;
    upload: GuideArticleContent;
    live: GuideArticleContent;
  };
};

const zhCN: GuidePageContent = {
  metadataTitle: "系统说明 · EgoCapture",
  metadataDescription: "EgoCapture 采集业务闭环、可靠上传、系统架构与未来直播方案。",
  kicker: "EgoCapture · 系统说明",
  releaseLabel: "随代码版本发布",
  title: "系统说明",
  intro: "面向业务负责人、管理员与演示者，说明一次采集如何发起、交接、核验和收口，并清楚区分当前能力与未来设计。",
  evidenceLabel: "当前实现与证据",
  futureLabel: "未来参考方案",
  noPromiseLabel: "不等同于生产承诺",
  contentsLabel: "文章目录",
  conclusionLabel: "结论先行",
  openDiagramLabel: "打开交互图",
  referencesLabel: "依据与延伸阅读",
  newTabLabel: "（在新标签页打开）",
  statusLabels: { current: "当前已实现", future: "未来方案", boundary: "能力边界" },
  articles: {
    architecture: {
      eyebrow: "系统架构",
      title: "整个系统的架构",
      summary: "EgoCapture 将业务控制面与视频数据面分开：两套 Web 应用负责身份、任务和审核，浏览器把视频直接传到私有对象存储。",
      conclusion: "PostgreSQL 保存参与者、任务、会话、上传与审核的业务权威；Storage 只保存私有对象字节。文件名、设备标识和 metadata 是证据，不会成为业务身份。",
      diagramTitle: "EgoCapture 当前系统架构",
      diagramDescription: "展示 Admin、Participant、共享核心、PostgreSQL、TUS 数据面与后台处理边界。",
      sections: [
        { eyebrow: "应用边界", title: "两个产品界面，一套共享规则", paragraphs: ["Admin Web 面向运营人员，管理参与者、任务版本、分配、上传、复核与审计；Participant Web 面向参与者，负责确认任务、建立录制会话和恢复上传。", "两套 Next.js 应用共享核心领域合同与 UI 基础，关键业务判断不会依靠复制保持一致。"] },
        { eyebrow: "事实来源", title: "控制面、数据面和证据链", facts: [
          { label: "控制面", value: "身份、JSON 命令、任务和审核经由 Route Handlers 进入核心服务，并写入 PostgreSQL。" },
          { label: "视频数据面", value: "参与者浏览器通过 TUS 直传私有 Storage，视频字节不经过 Web Function。" },
          { label: "服务端关联", value: "Participant、TaskVersion、Assignment、RecordingSession 与 object key 均由服务端推导。" },
          { label: "逐层推进", value: "对象对账、metadata、Validation、Match、Review 与 Audit 逐层推进，单层成功不能替代完整闭环。" },
        ] },
        { eyebrow: "验证边界", title: "本页不能代表什么", paragraphs: ["本地真实浏览器闭环不等于公网可用性、生产容量或跨区域容灾证明。Multipart、直播、视频内二维码识别和自动内容判断仍是未来能力。"] },
      ],
      references: [
        { label: "README.md", note: "双应用、控制面与数据面边界" },
        { label: "database/migrations/0001_core.sql", note: "核心实体、约束与不可变审计" },
        { label: "packages/core/src/server", note: "认证、数据库、Storage 与业务服务" },
      ],
    },
    workflow: {
      eyebrow: "双端联动",
      title: "管理员与参与者如何完成一次采集",
      summary: "以一次采集为主线，说明管理员如何发起和收口、参与者如何准备和提交，以及系统如何核验、反馈并保留恢复入口。",
      conclusion: "上传进度达到 100% 不等于采集完成。文件完整且归属清楚，并由管理员接受或完成重录、纠正、拒绝等处置后，采集才真正闭环。",
      diagramTitle: "管理员、参与者与系统协作流程",
      diagramDescription: "展示从定义目标到管理员接受的主路径，以及纠正或重录的异常支路。",
      sections: [
        { eyebrow: "从发起到接受", title: "一次采集的五个阶段", steps: [
          { title: "管理员准备并发布", description: "明确目标、步骤、画面要求、禁止事项、设备与截止时间；发布后冻结本次要求。" },
          { title: "参与者理解并准备", description: "阅读完整要求，检查设备、电量、存储和现场条件；条件不足时先反馈。" },
          { title: "建立会话并录制", description: "创建可追踪的 Recording Session，核对设备与现场标记，保留未改写的原始视频。" },
          { title: "提交并由系统核验", description: "选择正确会话和原文件，使用可暂停、可恢复的直传；上传完成后继续做文件与归属核验。" },
          { title: "管理员复核收口", description: "接受正常素材；对异常选择延期、纠正、拒绝或要求重录，并保留处置原因。" },
        ] },
        { eyebrow: "异常闭环", title: "失败后如何继续", facts: [
          { label: "未开始或逾期", value: "联系参与者并选择延期、替换或停止，让项目进度反映真实风险。" },
          { label: "录制条件不足", value: "开始前反馈并暂缓，条件恢复后从准备阶段继续。" },
          { label: "上传中断", value: "保留远端已确认进度，稍后继续，不从头传输整段视频。" },
          { label: "文件或归属异常", value: "系统不自动猜测；管理员依据任务、参与者和现场证据纠正或要求重录。" },
        ] },
      ],
    },
    upload: {
      eyebrow: "大型文件上传",
      title: "视频如何分片、暂停并恢复",
      summary: "说明大文件为何不会因暂停、断网或刷新而从头重传，并区分当前 TUS 能力与未来持久化 Multipart 设计。",
      conclusion: "恢复必须以远端确认的字节位置或分片清单为准。浏览器缓存的百分比只用于找回界面，不能单方面宣布上传成功。",
      diagramTitle: "可靠上传与恢复流程",
      diagramDescription: "展示初始化、暂停、重新选择原文件、远端对账、续传和完成核验。",
      sections: [
        { eyebrow: "当前体验", title: "可靠上传的关键步骤", steps: [
          { title: "建立上传会话", description: "记录文件名、大小、修改时间和指纹，并确认对应的采集会话。" },
          { title: "分片直传", description: "小段按有限并发上传；单片失败只重试该片，视频字节不经业务服务器。" },
          { title: "暂停并保留资格", description: "停止发送新数据，但保留会话和远端已经确认的进度。" },
          { title: "刷新后重新选择原文件", description: "浏览器不能在用户不知情时重读本地文件，因此需要再次选择并核对身份。" },
          { title: "远端对账后继续", description: "从上传服务确认的位置继续，只传缺失部分。" },
          { title: "完整性与业务核验", description: "传输完成后仍需对象、文件归属、匹配与人工审核通过。" },
        ] },
        { eyebrow: "交付边界", title: "当前与未来能力", facts: [
          { label: "当前 TUS", value: "支持分片直传、暂停、继续和刷新后恢复；仍受文件大小与上传通道有效期限制。" },
          { label: "未来 Multipart", value: "面向数 GB、弱网和跨天上传，持久保存分片回执并补齐合并、取消和超期清理合同。" },
          { label: "暂停", value: "保留会话和确认进度，继续时先对账。" },
          { label: "取消", value: "终止继续资格并安排清理残片；再次上传必须创建新会话。" },
        ] },
      ],
      references: [
        { label: "TUS resumable upload protocol", href: "https://tus.io/protocols/resumable-upload", note: "恢复位置与过期语义" },
        { label: "Supabase resumable uploads", href: "https://supabase.com/docs/guides/storage/uploads/resumable-uploads", note: "当前直传边界" },
        { label: "Amazon S3 Multipart upload", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html", note: "未来 Multipart 参考" },
      ],
    },
    live: {
      eyebrow: "直播采集与归档",
      title: "参与者推流，管理端如何保存视频",
      summary: "未来直播能力由参与者采集端推向专业直播服务，平台在服务端录制到私有对象存储；管理端观察和审核归档状态。",
      conclusion: "建议采用内部 LiveCapture 权威和可替换供应商适配器。AWS IVS 是参考路径，不是已接入能力，供应商 ID 也不会成为业务主键。",
      diagramTitle: "未来直播与服务端归档时序",
      diagramDescription: "展示短期推流授权、服务端录制、幂等回调、资产登记和 Admin 回看。",
      sections: [
        { eyebrow: "参考路径", title: "推荐的端到端方案", steps: [
          { title: "创建内部 LiveCapture", description: "在 Recording Session 下创建内部记录，再由 provider adapter 分配输入并签发短期授权。" },
          { title: "参与者开始推流", description: "浏览器或移动端向直播服务推流，长期云凭据不会下发给客户端。" },
          { title: "服务端录制到私有存储", description: "直播服务接收媒体并自动归档 manifests、segments 和 recording metadata。" },
          { title: "幂等处理供应商事件", description: "回调按 provider 与 event ID 去重，并容忍重复和乱序。" },
          { title: "接入现有证据链", description: "Worker 对账路径与会话，登记 VideoAsset，并继续 Validation、Match 与 Review。" },
          { title: "Admin 受控回看", description: "管理端读取内部状态并使用短期回放地址，访问与处置继续写入审计。" },
        ] },
        { eyebrow: "能力边界", title: "治理重点", facts: [
          { label: "内部状态", value: "推流中、录制中、归档中、已归档与失败由平台状态机管理；供应商事件只是证据。" },
          { label: "鉴权", value: "推流授权短期、单会话、可撤销；结束后停止输入并轮换密钥。" },
          { label: "失败恢复", value: "验证回调来源、去重、容忍乱序并定期补偿查询；缺失对象进入复核。" },
          { label: "上线前验证", value: "独立验证区域、编码、断线缺口、回调延迟、导出、删除回执、保留策略与成本。" },
        ] },
      ],
      references: [
        { label: "Amazon IVS Web Broadcast SDK", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-web.html", note: "浏览器推流参考" },
        { label: "Amazon IVS Auto-record to S3", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html", note: "服务端归档参考" },
      ],
    },
  },
};

const en: GuidePageContent = {
  metadataTitle: "System guide · EgoCapture",
  metadataDescription: "EgoCapture collection workflow, reliable uploads, architecture, and future live-capture design.",
  kicker: "EgoCapture · System guide", releaseLabel: "Versioned with the code", title: "System guide",
  intro: "A guide for business owners, operators, and presenters: how a collection is started, handed off, verified, and closed, with a clear line between current capability and future design.",
  evidenceLabel: "Current implementation and evidence", futureLabel: "Future reference design", noPromiseLabel: "Not a production commitment", contentsLabel: "Contents",
  conclusionLabel: "Bottom line", openDiagramLabel: "Open interactive diagram", referencesLabel: "References and further reading", newTabLabel: " (opens in a new tab)",
  statusLabels: { current: "Implemented now", future: "Future design", boundary: "Capability boundary" },
  articles: {
    architecture: {
      eyebrow: "System architecture", title: "How the whole system fits together",
      summary: "EgoCapture separates the business control plane from the video data plane. Two web apps manage identity, tasks, and review while browsers upload video directly to private object storage.",
      conclusion: "PostgreSQL is authoritative for participants, tasks, sessions, uploads, and review. Storage holds private object bytes. Filenames, device identifiers, and metadata are evidence, never business identity.",
      diagramTitle: "Current EgoCapture architecture", diagramDescription: "Admin, Participant, shared core, PostgreSQL, the TUS data plane, and background-processing boundaries.",
      sections: [
        { eyebrow: "Application boundary", title: "Two products, one rule set", paragraphs: ["Admin Web lets operators manage participants, task versions, assignments, uploads, reviews, and audits. Participant Web lets participants confirm tasks, create recording sessions, and resume uploads.", "Both Next.js apps share domain contracts and UI foundations. Critical business rules stay consistent through shared code, not copied decisions."] },
        { eyebrow: "Source of truth", title: "Control plane, data plane, and evidence", facts: [
          { label: "Control plane", value: "Identity, JSON commands, tasks, and reviews enter core services through Route Handlers and persist in PostgreSQL." },
          { label: "Video data plane", value: "Participant browsers upload through TUS to private Storage. Video bytes do not pass through the web function." },
          { label: "Server-side binding", value: "Participant, TaskVersion, Assignment, RecordingSession, and object keys are derived by the server." },
          { label: "Layered processing", value: "Reconciliation, metadata, validation, matching, review, and audit progress independently; one successful layer is not the full workflow." },
        ] },
        { eyebrow: "Verified boundary", title: "What this page does not prove", paragraphs: ["A local real-browser workflow does not prove public availability, production capacity, or cross-region recovery. Multipart, live streaming, in-video QR recognition, and automatic content decisions remain future capabilities."] },
      ],
      references: [{ label: "README.md", note: "Dual apps and control/data-plane boundary" }, { label: "database/migrations/0001_core.sql", note: "Core entities, constraints, and immutable audit" }, { label: "packages/core/src/server", note: "Authentication, database, Storage, and services" }],
    },
    workflow: {
      eyebrow: "Two-sided workflow", title: "How operators and participants complete a collection",
      summary: "A collection from start to close: how operators initiate and resolve it, how participants prepare and submit, and how the system verifies, reports, and preserves recovery paths.",
      conclusion: "A 100% upload is not a completed collection. The file must be intact and correctly attributed, then an operator must accept it or resolve rerecording, correction, or rejection.",
      diagramTitle: "Operator, participant, and system workflow", diagramDescription: "The main path from defining the goal to acceptance, plus correction and rerecording branches.",
      sections: [
        { eyebrow: "From launch to acceptance", title: "Five stages of a collection", steps: [
          { title: "Prepare and publish", description: "Define the goal, steps, framing, prohibited content, device, and due date; publishing freezes this version." },
          { title: "Understand and prepare", description: "Read the requirements and check device, battery, storage, and location; report blockers before recording." },
          { title: "Create a session and record", description: "Create a traceable Recording Session, verify the device and marker, and preserve the unmodified source video." },
          { title: "Submit and verify", description: "Choose the correct session and source file, upload with pause/resume, then allow file and ownership checks to finish." },
          { title: "Review and close", description: "Accept valid material or extend, correct, reject, or request a rerecord while retaining the reason." },
        ] },
        { eyebrow: "Exception closure", title: "How work continues after failure", facts: [
          { label: "Not started or overdue", value: "Contact the participant and extend, replace, or stop the assignment so progress reflects the real risk." },
          { label: "Recording conditions fail", value: "Pause before starting, report the issue, and continue from preparation when conditions recover." },
          { label: "Upload interrupted", value: "Keep remotely confirmed progress and continue later without retransmitting the whole video." },
          { label: "File or ownership mismatch", value: "The system does not guess. An operator uses task, participant, and field evidence to correct or request a rerecord." },
        ] },
      ],
    },
    upload: {
      eyebrow: "Large-file upload", title: "How video upload pauses and resumes",
      summary: "Why a large file does not restart after a pause, disconnect, or refresh, and how current TUS support differs from a future persistent Multipart design.",
      conclusion: "Recovery must use the byte offset or part list confirmed by the remote upload service. A browser-cached percentage can restore the UI, but cannot declare success.",
      diagramTitle: "Reliable upload and recovery", diagramDescription: "Initialization, pause, source-file reselection, remote reconciliation, resume, and final verification.",
      sections: [
        { eyebrow: "Current experience", title: "The reliable-upload path", steps: [
          { title: "Create an upload session", description: "Record filename, size, modified time, and fingerprint, then bind the correct collection session." },
          { title: "Upload parts directly", description: "Use bounded concurrency. Retry only the failed part; media bytes bypass the business server." },
          { title: "Pause without losing eligibility", description: "Stop new transfers while retaining the session and remotely confirmed progress." },
          { title: "Reselect after refresh", description: "Browser file permissions require the participant to choose the original file again before it can be read." },
          { title: "Reconcile and resume", description: "Ask the upload service for the authoritative position and send only what is missing." },
          { title: "Verify before acceptance", description: "After transfer, object, attribution, matching, and human-review checks still must pass." },
        ] },
        { eyebrow: "Delivery boundary", title: "Current and future capability", facts: [
          { label: "Current TUS", value: "Parted direct upload, pause, continue, and refresh recovery, subject to file-size and channel-lifetime limits." },
          { label: "Future Multipart", value: "For multi-GB, weak-network, multi-day uploads: durable part receipts, assembly, cancellation, and expiry cleanup." },
          { label: "Pause", value: "Keep the session and confirmed progress, then reconcile before continuing." },
          { label: "Cancel", value: "End resume eligibility and clean up parts. A later upload needs a new session." },
        ] },
      ],
      references: [{ label: "TUS resumable upload protocol", href: "https://tus.io/protocols/resumable-upload", note: "Offset and expiry semantics" }, { label: "Supabase resumable uploads", href: "https://supabase.com/docs/guides/storage/uploads/resumable-uploads", note: "Current direct-upload boundary" }, { label: "Amazon S3 Multipart upload", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html", note: "Future Multipart reference" }],
    },
    live: {
      eyebrow: "Live capture and archive", title: "How a participant stream becomes stored video",
      summary: "A future capture client sends media to a streaming provider, which records it server-side into private object storage. Admin observes and reviews the archive state.",
      conclusion: "Use an internal LiveCapture authority with replaceable provider adapters. AWS IVS is a reference path, not an integrated capability, and provider IDs never become business keys.",
      diagramTitle: "Future live stream and server-side archive", diagramDescription: "Short-lived publish access, provider recording, idempotent callbacks, asset registration, and controlled playback.",
      sections: [
        { eyebrow: "Reference path", title: "Recommended end-to-end design", steps: [
          { title: "Create internal LiveCapture", description: "Create an internal record under Recording Session, then let the adapter allocate input and issue short-lived access." },
          { title: "Start participant streaming", description: "A browser or mobile client streams to the provider. Long-lived cloud credentials never reach the client." },
          { title: "Record to private storage", description: "The provider receives media and archives manifests, segments, and recording metadata server-side." },
          { title: "Process provider events idempotently", description: "Deduplicate callbacks by provider and event ID, and tolerate repeats and reordering." },
          { title: "Join the existing evidence chain", description: "A worker reconciles paths and sessions, registers VideoAsset, then continues validation, matching, and review." },
          { title: "Controlled Admin playback", description: "Admin reads internal status and uses short-lived playback access; viewing and decisions remain audited." },
        ] },
        { eyebrow: "Capability boundary", title: "Governance priorities", facts: [
          { label: "Internal state", value: "Streaming, recording, archiving, archived, and failed are platform states. Provider events are evidence." },
          { label: "Authorization", value: "Publishing access is short-lived, single-session, and revocable; input and keys rotate when the session ends." },
          { label: "Recovery", value: "Verify callback sources, deduplicate, tolerate reordering, reconcile periodically, and send missing objects to review." },
          { label: "Before launch", value: "Validate region, codecs, disconnect gaps, callback latency, export, deletion receipts, retention, and unit cost." },
        ] },
      ],
      references: [{ label: "Amazon IVS Web Broadcast SDK", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-web.html", note: "Browser broadcast reference" }, { label: "Amazon IVS Auto-record to S3", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html", note: "Server-side archive reference" }],
    },
  },
};

const ja: GuidePageContent = {
  metadataTitle: "システムガイド · EgoCapture",
  metadataDescription: "EgoCapture の収集業務、信頼できるアップロード、システム構成、将来のライブ収集設計。",
  kicker: "EgoCapture · システムガイド", releaseLabel: "コードの版と同時に公開", title: "システムガイド",
  intro: "事業責任者、運用担当者、デモ担当者向けに、収集の開始、引き継ぎ、検証、完了を説明し、現在の機能と将来設計を明確に区別します。",
  evidenceLabel: "現在の実装と証拠", futureLabel: "将来の参考設計", noPromiseLabel: "本番提供の約束ではありません", contentsLabel: "目次",
  conclusionLabel: "先に結論", openDiagramLabel: "インタラクティブ図を開く", referencesLabel: "根拠と参考資料", newTabLabel: "（新しいタブで開きます）",
  statusLabels: { current: "実装済み", future: "将来設計", boundary: "機能の境界" },
  articles: {
    architecture: {
      eyebrow: "システム構成", title: "システム全体の構成",
      summary: "EgoCapture は業務の制御面と動画のデータ面を分離します。2 つの Web アプリが認証、タスク、審査を管理し、ブラウザは動画を非公開オブジェクトストレージへ直接送信します。",
      conclusion: "PostgreSQL は参加者、タスク、セッション、アップロード、審査の業務上の正本です。Storage は非公開オブジェクトのバイトだけを保持し、ファイル名や機器 ID、metadata は証拠であって業務 ID ではありません。",
      diagramTitle: "現在の EgoCapture システム構成", diagramDescription: "Admin、Participant、共有コア、PostgreSQL、TUS データ面、バックグラウンド処理の境界を示します。",
      sections: [
        { eyebrow: "アプリケーション境界", title: "2 つの画面、1 つのルール", paragraphs: ["Admin Web は参加者、タスク版、割り当て、アップロード、審査、監査を管理します。Participant Web はタスク確認、録画セッション作成、アップロード再開を担当します。", "両方の Next.js アプリはドメイン契約と UI 基盤を共有します。重要な判断をコピーして一致させる設計ではありません。"] },
        { eyebrow: "正本", title: "制御面、データ面、証拠チェーン", facts: [
          { label: "制御面", value: "認証、JSON コマンド、タスク、審査は Route Handlers からコアサービスへ入り、PostgreSQL に保存されます。" },
          { label: "動画データ面", value: "参加者ブラウザは TUS で非公開 Storage へ直接送信し、動画バイトは Web Function を通りません。" },
          { label: "サーバー側の関連付け", value: "Participant、TaskVersion、Assignment、RecordingSession、object key はサーバーが導出します。" },
          { label: "段階的な処理", value: "照合、metadata、検証、マッチ、審査、監査は段階的に進み、1 段階の成功だけでは完了しません。" },
        ] },
        { eyebrow: "検証済みの境界", title: "このページが証明しないこと", paragraphs: ["ローカルの実ブラウザ検証は、公開環境の可用性、本番容量、リージョン間復旧を証明しません。Multipart、ライブ配信、動画内 QR 認識、自動内容判定は将来機能です。"] },
      ],
      references: [{ label: "README.md", note: "2 つのアプリと制御面・データ面の境界" }, { label: "database/migrations/0001_core.sql", note: "主要エンティティ、制約、変更不能な監査" }, { label: "packages/core/src/server", note: "認証、データベース、Storage、業務サービス" }],
    },
    workflow: {
      eyebrow: "両画面の連携", title: "管理者と参加者が収集を完了する流れ",
      summary: "管理者が開始して完了させ、参加者が準備して提出し、システムが検証、通知、再開手段を提供する一連の流れです。",
      conclusion: "アップロードが 100% でも収集完了ではありません。ファイルの完全性と帰属を確認し、管理者が承認、再撮影、修正、拒否の処置を完了して初めて閉じます。",
      diagramTitle: "管理者、参加者、システムの協力フロー", diagramDescription: "目標定義から承認までの主経路と、修正・再撮影の例外経路を示します。",
      sections: [
        { eyebrow: "開始から承認まで", title: "収集の 5 段階", steps: [
          { title: "準備して公開", description: "目標、手順、画角、禁止事項、機器、期限を定義し、公開時にその版を固定します。" },
          { title: "理解して準備", description: "要件を読み、機器、電池、容量、現場を確認し、問題は録画前に報告します。" },
          { title: "セッションを作成して録画", description: "追跡可能な Recording Session を作り、機器とマーカーを確認し、未編集の元動画を保持します。" },
          { title: "提出して検証", description: "正しいセッションと元ファイルを選び、停止・再開可能な送信後にファイルと帰属を検証します。" },
          { title: "審査して完了", description: "正常素材を承認し、異常時は延長、修正、拒否、再撮影を理由付きで処置します。" },
        ] },
        { eyebrow: "例外の完了", title: "失敗後の続行方法", facts: [
          { label: "未開始または期限超過", value: "参加者へ連絡し、延長、交代、停止を選び、実際のリスクを進捗に反映します。" },
          { label: "録画条件が不足", value: "開始前に報告して保留し、条件が回復したら準備段階から続けます。" },
          { label: "アップロード中断", value: "サーバーで確認済みの進捗を保持し、動画全体を最初から送らずに再開します。" },
          { label: "ファイルまたは帰属の不一致", value: "自動推測せず、タスク、参加者、現場証拠から修正または再撮影を判断します。" },
        ] },
      ],
    },
    upload: {
      eyebrow: "大容量ファイル", title: "動画アップロードの停止と再開",
      summary: "停止、切断、再読み込み後も最初からやり直さない理由と、現在の TUS と将来の永続 Multipart 設計の違いを説明します。",
      conclusion: "再開位置はアップロードサービスが確認したバイト位置またはパート一覧を正本とします。ブラウザの割合表示は画面復元用で、成功を宣言する根拠ではありません。",
      diagramTitle: "信頼できるアップロードと再開", diagramDescription: "初期化、停止、元ファイル再選択、サーバー照合、再開、完了検証を示します。",
      sections: [
        { eyebrow: "現在の体験", title: "信頼できるアップロード手順", steps: [
          { title: "アップロードセッションを作成", description: "ファイル名、サイズ、更新時刻、指紋を記録し、正しい収集セッションへ関連付けます。" },
          { title: "分割して直接送信", description: "同時数を制限し、失敗した部分だけ再試行します。媒体バイトは業務サーバーを経由しません。" },
          { title: "資格を保ったまま停止", description: "新しい送信を止め、セッションとサーバーで確認済みの進捗を保持します。" },
          { title: "再読み込み後に元ファイルを再選択", description: "ブラウザの権限制約により、参加者が再び元ファイルを選ぶ必要があります。" },
          { title: "照合して再開", description: "アップロードサービスの正しい位置を確認し、不足部分だけ送信します。" },
          { title: "承認前に検証", description: "送信後もオブジェクト、帰属、マッチ、人工審査を通過する必要があります。" },
        ] },
        { eyebrow: "提供範囲", title: "現在と将来の機能", facts: [
          { label: "現在の TUS", value: "分割した直接送信、停止、続行、再読み込み後の復旧を支援しますが、サイズとチャネル有効期限の制限があります。" },
          { label: "将来の Multipart", value: "数 GB、弱い回線、複数日に対応し、パートの受領記録、結合、キャンセル、期限切れデータの削除を永続的に管理します。" },
          { label: "停止", value: "セッションと確認済み進捗を保持し、照合後に続けます。" },
          { label: "キャンセル", value: "再開資格を終了して残存パートを削除します。再送信には新しいセッションが必要です。" },
        ] },
      ],
      references: [{ label: "TUS resumable upload protocol", href: "https://tus.io/protocols/resumable-upload", note: "再開位置と期限切れ" }, { label: "Supabase resumable uploads", href: "https://supabase.com/docs/guides/storage/uploads/resumable-uploads", note: "現在の直接送信の境界" }, { label: "Amazon S3 Multipart upload", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html", note: "将来 Multipart の参考" }],
    },
    live: {
      eyebrow: "ライブ収集と保管", title: "参加者の配信を管理側で動画保存する方法",
      summary: "将来の収集クライアントは専門サービスへ配信し、サービス側で非公開ストレージに録画します。Admin は保管状態を監視して審査します。",
      conclusion: "内部 LiveCapture を正本とし、交換可能な provider adapter を使います。AWS IVS は参考経路で、導入済み機能ではなく、provider ID も業務キーにはしません。",
      diagramTitle: "将来のライブ配信とサーバー側保管", diagramDescription: "短期配信権限、サービス側録画、冪等コールバック、資産登録、制御された再生を示します。",
      sections: [
        { eyebrow: "参考経路", title: "推奨エンドツーエンド設計", steps: [
          { title: "内部 LiveCapture を作成", description: "Recording Session の下に内部記録を作り、adapter が入力と短期権限を発行します。" },
          { title: "参加者が配信開始", description: "ブラウザまたはモバイル端末から provider へ配信し、長期クラウド認証情報は渡しません。" },
          { title: "非公開ストレージへ録画", description: "provider が媒体を受信し、manifests、segments、recording metadata をサーバー側で保管します。" },
          { title: "provider イベントを冪等処理", description: "provider と event ID で重複を排除し、重複と順序逆転を許容します。" },
          { title: "既存の証拠チェーンへ接続", description: "Worker が経路とセッションを照合し、VideoAsset を登録して検証、マッチ、審査へ進めます。" },
          { title: "Admin の制御された再生", description: "内部状態と短期再生 URL を使い、閲覧と処置を監査に記録します。" },
        ] },
        { eyebrow: "機能の境界", title: "ガバナンスの重点", facts: [
          { label: "内部状態", value: "配信中、録画中、保管中、保管済み、失敗は内部ステートマシンで管理し、provider event は証拠として扱います。" },
          { label: "認可", value: "配信権限は短期、単一セッション、取り消し可能とし、終了時に入力停止とキー交換を行います。" },
          { label: "復旧", value: "コールバック元を検証し、重複排除、順序逆転、定期照合に対応し、欠落オブジェクトを審査へ送ります。" },
          { label: "提供前の検証", value: "リージョン、codec、切断欠損、コールバック遅延、export、削除証跡、保持方針、単価を個別に検証します。" },
        ] },
      ],
      references: [{ label: "Amazon IVS Web Broadcast SDK", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-web.html", note: "ブラウザ配信の参考" }, { label: "Amazon IVS Auto-record to S3", href: "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html", note: "サーバー側保管の参考" }],
    },
  },
};

export const guideContent: Record<UiLocale, GuidePageContent> = { "zh-CN": zhCN, en, ja };
