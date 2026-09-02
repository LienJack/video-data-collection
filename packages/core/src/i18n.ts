import { lifecycleMachines } from "./domain/lifecycle-machines";

export const SUPPORTED_LOCALES = ["zh-CN", "en", "ja"] as const;
export type UiLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: UiLocale = "zh-CN";
export const LOCALE_COOKIE_NAME = "egocapture-locale";

export type MessageValues = Record<string, string | number | Date | null | undefined>;

const zhCN = {
  meta: {
    adminTitle: "EgoCapture — 研究运营控制台",
    adminDescription: "管理参与者、采集任务、录制会话、上传与人工复核。",
    participantTitle: "EgoCapture — 参与者采集门户",
    participantDescription: "查看第一人称视频采集任务、创建录制会话并安全上传素材。",
  },
  language: {
    label: "语言",
    zhCN: "简体中文",
    en: "English",
    ja: "日本語",
    changing: "正在切换语言…",
    changeFailed: "无法切换语言，请重试。",
  },
  common: {
    admin: "管理员",
    participant: "参与者",
    loading: "正在加载…",
    saving: "正在保存…",
    submitting: "正在提交…",
    cancel: "取消",
    close: "关闭",
    confirm: "确认",
    continue: "继续",
    save: "保存",
    edit: "编辑",
    delete: "删除",
    retry: "重试",
    refresh: "刷新",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    view: "查看",
    details: "详情",
    status: "状态",
    actions: "操作",
    createdAt: "创建时间",
    updatedAt: "更新时间",
    dueAt: "截止时间",
    expiresAt: "有效期至",
    name: "名称",
    email: "邮箱",
    notes: "备注",
    device: "设备",
    reason: "原因",
    optional: "可选",
    default: "默认",
    none: "无",
    unknown: "未知",
    notAvailable: "不可用",
    yes: "是",
    no: "否",
    files: { one: "{count} 个文件", other: "{count} 个文件" },
    bytes: "{value} 字节",
    version: "版本 {value}",
    pageOf: "第 {page} 页，共 {pages} 页",
    empty: "暂无数据。",
  },
  nav: {
    adminPrimary: "主要管理导航",
    allFeatures: "全部管理功能",
    overview: "总览",
    tasks: "采集任务",
    participants: "参与者",
    review: "待处理",
    records: "采集记录",
    systemGuide: "系统说明",
    videoOperations: "视频采集运营",
    participantNav: "参与者导航",
    myTasks: "任务",
    uploads: "上传",
    logout: "退出登录",
    loggingOut: "正在退出…",
  },
  auth: {
    adminAccount: "管理员账号",
    participantId: "参与者 ID",
    password: "密码",
    passwordHint: "至少 10 位",
    verifying: "正在验证…",
    enterAdmin: "进入管理控制台",
    enterParticipant: "进入我的任务",
    loginFailed: "登录失败，请稍后再试。",
    networkFailed: "无法连接服务，请检查网络后重试。",
    adminHeading: "研究运营控制台",
    adminIntro: "管理参与者、任务、录制会话、上传与人工复核。",
    participantHeading: "参与者采集门户",
    participantIntro: "查看任务、建立录制会话并安全上传第一人称视频。",
    adminAccess: "管理员访问",
    adminHeadline: "把每一次采集，变成可追踪的研究证据。",
    adminAudit: "参与者、任务、上传与复核统一审计",
    authorizedOnly: "仅供获授权的研究运营人员使用。",
    separated: "管理员入口与参与者门户已完全分离。",
    fieldOperation: "现场采集",
    participantQuote: "认真完成一次记录，让真实的过程被看见。",
    privateStorage: "私有对象存储",
    appendAudit: "追加写审计",
    demoSynthetic: "演示仅使用合成身份与无敏感信息的视频。",
    participantAccess: "参与者访问",
    participantContinue: "继续你的采集任务",
    participantLoginHelp: "使用邀请中 PT 开头的参与者 ID 登录。管理控制台位于独立域名。",
  },
  shell: {
    errorTitle: "页面遇到问题",
    errorBody: "暂时无法显示此页面，请重试。",
    notFoundTitle: "页面不存在",
    notFoundBody: "该页面可能已移动，或你没有访问权限。",
    backHome: "返回首页",
    safeFailure: "安全失败",
    adminErrorTitle: "控制台暂时没有加载成功",
    adminErrorBody: "业务数据没有被修改，请稍后重试。",
    participantErrorTitle: "这一页暂时没有加载成功",
    participantErrorBody: "业务数据没有被修改。请重试；若问题持续，可返回上一页继续操作。",
    reload: "重新加载",
    adminNotFoundTitle: "这条管理路径不存在",
    participantNotFoundTitle: "这条采集路径不存在",
    participantNotFoundBody: "链接可能已经失效，或当前账号无权访问对应对象。",
    loadingAdmin: "正在加载管理页面",
    loadingParticipant: "正在加载参与者页面",
  },
  participantUi: {
    homePlatform: "第一人称视频采集平台",
    loginWorkbench: "登录工作台",
    heroLine1: "视频记录现场。",
    heroLine2: "每段素材都有清晰来路。",
    heroBody: "参与者根据已发布的任务完成录制和上传；研究团队可查看任务版本、录制会话、上传进度与复核结果，随时了解每段视频的来源和状态。",
    viewWorkflow: "查看三步流程",
    demoWarning: "演示环境请勿使用真实身份或上传敏感视频。开展真实采集前，请确认已完成知情同意和数据治理流程。",
    proofKicker: "不止存储，更可追溯",
    proofHeading: "每段视频的来源和处理状态都可核查。",
    proofVersion: "固定任务版本",
    proofVersionBody: "采集开始后不受草稿修改影响",
    proofMarker: "签名会话标记",
    proofMarkerBody: "记录本次采集所属会话",
    proofResume: "支持断点续传",
    proofResumeBody: "暂停或中断后可以继续上传",
    proofDirect: "直传私有存储",
    proofDirectBody: "视频不经过应用服务器",
    workflowKicker: "三步完成采集",
    workflowHeading: "参与者按步骤完成采集，研究团队随时查看进度。",
    workflowBody: "参与者只需按页面提示操作；系统会自动保存任务版本、录制会话、上传状态和复核结果。",
    workflow1Title: "确认本次采集任务",
    workflow1Body: "开始前查看已发布的任务说明。采集开始后，本次任务内容不会受后续草稿修改影响。",
    workflow2Title: "创建录制会话",
    workflow2Body: "录制前创建会话并生成不含个人信息的签名标记，用于记录本次录制对应的任务。",
    workflow3Title: "选择会话并上传视频",
    workflow3Body: "选择对应的录制会话后上传视频。上传可暂停、可恢复；疑似异常或重复的视频会进入人工复核，不会自动删除。",
    footerHeading: "登录后开始采集或管理任务。",
    footerBody: "参与者使用邀请中的参与者 ID，管理员使用工作邮箱登录。",
    previewReady: "就绪",
    previewAria: "会话状态预览",
    previewDemo: "演示会话",
    previewActivity: "日常活动采集",
    previewMarker: "会话标记",
    previewMarkerReady: "已签名，可以开始录制",
    previewNoIdentity: "不包含个人身份信息",
    previewTaskVersion: "任务版本",
    previewFrozen: "已冻结",
    previewSessionMarker: "会话标记",
    previewGenerated: "已生成",
    previewUploadStatus: "上传状态",
    previewAwaitRecording: "待录制",
    tasksKicker: "参与者现场应用",
    greeting: "你好，{name}",
    tasksImmutable: "每个任务固定到发布时的任务版本；后续草稿修改不会改变你已收到的说明。",
    uploadRecordedFiles: "上传录制文件",
    noAssignments: "目前没有分配给你的任务。",
    myTasks: "我的任务",
    targetDuration: "目标时长：{duration}（允许 ±{tolerance}）",
    environmentAndArea: "环境与活动范围",
    environmentSetup: "环境准备",
    areaConstraints: "活动范围",
    requiredObjects: "必需物品",
    mustBeVisible: "需要入镜",
    needNotBeVisible: "无需特意入镜",
    recordingSteps: "录制步骤",
    expectedEvidence: "预期证据：{evidence}",
    defaultRecordingInstruction: "按任务描述完成活动，并保持连续录制。",
    mustShow: "必须展示",
    mustAvoid: "必须避开",
    otherRecordingConstraints: "其他录制约束",
    targetSpec: "目标规格：",
    firstPersonView: "头戴式第一人称视角",
    sessionMarker: "会话标记：",
    markerRequired: "必须展示并保持至少 {seconds} 秒",
    markerOptional: "可选展示",
    uploadAndRecovery: "上传与恢复",
    allowedSources: "允许来源：",
    uploadInstructions: "上传说明",
    recoveryInstructions: "中断后恢复",
    fileTaskMatching: "文件与任务匹配",
    completionCriteria: "完成条件",
    manualReview: "人工审核",
    metadataCheck: "上传后进行元数据检查",
    privacyCheck: "隐私检查",
    acknowledgedVersion: "已确认版本：{value}",
    showQrCode: "展示二维码",
    markerAcknowledged: "已确认",
    markerPending: "待确认",
    uploadVideo: "上传视频",
    sourceCamera: "相机 / 运动相机",
    sourceSsd: "外接 SSD",
    sourceMobile: "手机",
    sourceDesktop: "电脑",
    sourceOther: "其他外部存储",
    createSession: "创建录制会话",
    createSessionBody: "选择实际用于本次录制的设备；参与者和任务版本由服务端根据任务分配记录推导。",
    contactAdminDevice: "请先联系管理员登记设备。",
    sessionCreateFailed: "录制会话创建失败。",
    defaultDevice: "默认",
    creating: "创建中…",
    createSessionAndMarker: "创建会话并显示标记",
    acknowledging: "确认中…",
    acknowledgeVersion: "我已阅读并确认这个版本",
    acknowledgementFailed: "确认失败。",
    uploadFiles: "上传文件",
    signedMarker: "已签名的会话标记",
    validUntil: "有效至 {date}",
    markerQrAlt: "录制会话 {session} 的签名二维码",
    shortCode: "短码",
    markerPrivacy: "二维码仅包含会话、任务分配、设备公开 ID、时间、nonce 和 Ed25519 签名，不含姓名或邮箱。",
    downloadQr: "下载二维码",
    generating: "生成中…",
    regenerateMarker: "重新生成标记",
    markerConfirming: "确认中…",
    markerCaptured: "我已拍摄二维码",
    markerConfirmedAt: "已确认：{date}",
    sessionClosed: "会话已关闭",
    markerActionFailed: "标记操作失败。",
    directUpload: "TUS 直传",
    uploadPageBody: "视频字节从浏览器直达私有 Supabase Storage；Next.js 只签发单对象凭据并在完成后检查对象和大小。",
    invalidSessionTitle: "无法绑定该会话",
    invalidSessionBody: "该会话不存在、不属于当前参与者或已经关闭。请返回任务页，从仍可上传的会话重新进入。",
    backToTasks: "返回我的任务",
    recentUploads: "最近上传",
    noUploads: "还没有上传记录。",
    unableDetermine: "无法确定",
    uploadList: "上传列表",
    transfer: "传输",
    objectReconciliation: "对象核对",
    metadata: "元数据",
    match: "匹配",
    uploadAttempts: "上传尝试",
    noError: "无错误",
    lightweightMetadata: "轻量元数据",
    containerCodec: "容器 / 编码",
    metadataUnavailable: "元数据不可用",
    resolutionUnavailable: "分辨率不可用",
    fpsUnavailable: "帧率不可用",
    evidence: "证据",
    captureTime: "拍摄时间",
    reviewCount: "复核 {count}",
    noWarning: "无警告",
    invitationActivation: "参与者激活",
    acceptResearch: "确认参与研究",
    invitationInvalid: "邀请无效或已过期",
    invitationBody: "确认接受后，邀请会立即失效，并进入只属于你的参与者工作区。",
    invitationContactAdmin: "请联系管理员重新生成邀请。为保护账号，系统不会说明 Token 是否存在。",
    backToLogin: "返回登录",
    invitationAccountBody: "登录账号和系统生成的密码由管理员提供。确认后将激活你的参与者工作区。",
    activating: "正在激活…",
    acceptInvitation: "接受邀请并进入任务",
    queue: {
      requestFailed: "请求失败。", invalidType: "{file} 不是 MP4、MOV 或 INSV 文件。", invalidSize: "{file} 超过 50,000,000 字节或为空文件。", mimeMismatch: "{file} 的浏览器 MIME 与扩展名不匹配。", boundElsewhere: "该文件已有绑定其他会话的待恢复上传，请从通用上传页恢复或选择其他文件。", restoreMismatch: "所选文件与待恢复任务的原始文件不一致，请重新选择。", hashFailed: "无法计算完整文件 SHA-256。", batchLimit: "每批最多选择 {count} 个文件。", hashingPending: "文件指纹尚未完成。", chooseSession: "请为这个文件选择录制会话或“无法确定”。", resourceExpired: "TUS 资源已过期；重试会创建新的上传尝试。", uploadFailed: "上传失败：{message}", metadataFailed: "视频已完成并通过对象核对；元数据处理失败：{message}", parseFailed: "解析失败", reconcileFailed: "对象核对失败。", savedResourceMissing: "浏览器中的 TUS 资源地址已丢失；请创建新的上传尝试后重试。", prepareFailed: "上传准备失败。", boundSessionAria: "已绑定录制会话", boundSession: "已绑定会话，上传时不可切换", chooseFiles: "选择设备或 SSD 中的视频", fileLimits: "MP4 / MOV / INSV · 每批最多 5 个 · 单文件最多 50,000,000 字节", restorable: "待恢复上传（{count}）", restoreHelp: "出于浏览器安全限制，请重新选择原文件；完整 SHA-256 一致后才会恢复 TUS offset。", acceptedSaved: "已确认 {accepted} / {total} · 保存于 {date}", mayBeExpired: "资源可能已过期", restoreProgress: "待恢复上传进度 {progress}%", chooseOriginal: "选择原文件以恢复", legacyRestore: "另有 {count} 个旧版恢复记录。请从上方重新选择原文件，验证后会自动迁移并恢复。", modifiedAt: "修改于 {date}", recordingSession: "录制会话", lockedSessionAria: "锁定的录制会话", locked: "已锁定", choose: "请选择…", note: "备注（可选）", notePlaceholder: "不要填写敏感信息", uploadProgress: "上传进度 {progress}%", hashing: "正在计算完整文件 SHA-256…", resumed: "已从浏览器保存的 TUS offset 恢复", duplicate: "疑似重复：仅进入人工复核，不会自动删除或拒绝。", start: "开始直传存储", pause: "暂停", resume: "继续", newAttemptRetry: "创建新上传尝试并重试", resumeRetry: "恢复并重试", abort: "取消", serverStatus: "查看服务端状态",
    },
    metadataRanges: "范围 {count}/24",
  },
  adminUi: {
    operationsCenter: "采集运营中心", dashboard: "采集控制台", manageTasks: "管理采集任务", queue: "待处理队列", signalsToday: "今天需要处理的信号", missingUpload: "缺少上传", uploadFailed: "上传失败", metadataFailed: "元数据失败", unmatched: "尚未匹配", deviceMismatch: "设备不一致", awaitingReview: "等待复核", last24Hours: "最近 24 小时", assignmentProgress: "参与进度", uploadProgress: "上传进度", readonlyActivity: "只读操作记录", recentAudit: "最近审计", viewAll: "查看全部", noAudit: "目前没有审计事件。",
    taskCollaboration: "采集进度与人员协作", tasksTitle: "采集任务", tasksBody: "从任务进入参与者、录制进度和上传视频。运行中的任务至少保留一名参与者。", createTask: "创建任务", taskFilterAria: "筛选采集任务", taskSearchAria: "搜索任务", taskSearchPlaceholder: "搜索任务名称或编号", taskLifecycle: "任务生命周期", allTasks: "全部任务", published: "已发布", filter: "筛选", taskListAria: "任务列表", task: "任务", participants: "参与者", completed: "完成", videos: "视频", attention: "待处理", nextDue: "最近截止", unpublished: "尚未发布", noMatchingTasks: "没有符合条件的采集任务。清除筛选，或创建第一个任务。", taskList: "任务列表", taskTemplate: "任务模板", createRecordingTask: "创建录制任务",
    taskBack: "采集任务", demoData: "演示数据", taskHistorySafe: "一个任务对应一组参与者。每个人拥有独立进度、录制会话和视频，人员调整不会改写历史。", taskSummary: "任务汇总", taskDetails: "任务详情", overview: "概览", uploadedVideos: "上传视频", instructions: "任务说明", activityLog: "操作记录", publishedVersions: "已发布版本", frozen: "冻结", firstVersionBindingHelp: "可以先在“参与者”中维护发布名单。首次发布时，系统会把名单绑定到冻结版本并生成分配记录。",
    taskOverview: "任务概览", currentParticipants: "当前参与者", excludesStopped: "不含已停止人员", completedParticipants: "已完成人数", completionRate: "完成率 {value}%", validVideos: "有效视频", matchedToTask: "已匹配到本任务", needsHandling: "需要处理", handleSoon: "建议尽快检查", noAnomalies: "当前没有异常", overallProgress: "整体进度", participantsCompleted: "{completed} / {total} 人完成", taskCompletionRate: "任务完成率 {value}%", duePrefix: "截止 {date}", noPendingParticipants: "当前没有待完成的参与者。新增参与者后，最近截止时间会显示在这里。", recentActivity: "最近动态", receivedVideo: "收到视频：{filename}", uploadVerified: "上传已验证", uploadProcessing: "上传处理中", systemActor: "系统", noTaskActivity: "任务还没有上传或操作记录。",
    noTaskParticipants: "这个任务还没有参与者", addParticipantsHelp: "使用页面右上角的“添加参与者”，选择一人或多人后开始采集。", draftRoster: "草稿名单", bindOnFirstPublish: "首版发布时绑定", currentProgressCount: "{count} 人计入当前任务进度", sessions: "会话", historicalParticipants: "历史参与者", draftRosterState: "待发布",
    uploadsSummary: "共 {count} 个上传{attention}。", uploadsAttention: "，其中 {count} 个需要处理", uploadsNoAttention: "，当前没有待处理异常", openAttention: "打开待处理", humanReview: "人工复核", reviewItems: "{count} 项待处理", noHandlingNeeded: "无需处理", sessionLabel: "录制会话：{value}", notDetermined: "尚未确定", resolutionPending: "分辨率待解析", deviceConsistency: "设备一致性：{value}", awaitingReconciliation: "等待核对", viewUploadDetails: "查看上传详情", handleAnomaly: "处理异常", noUploadedVideos: "还没有上传视频", noUploadedVideosHelp: "参与者创建录制并上传后，传输、元数据、匹配和复核状态会集中显示在这里。",
    auditIntro: "记录任务、参与者和视频匹配的重要变更。历史记录只读，不会随人员调整而覆盖。", recorded: "已记录", operator: "操作者：{name}", object: "对象：{id}", changes: "变更内容：{fields}", moreChanges: " 等 {count} 项", reasonPrefix: "原因：", noActivity: "暂无操作记录", noActivityHelp: "添加或调整参与者、发布版本以及处理视频后，记录会显示在这里。",
    assignmentsKicker: "冻结任务交付", assignments: "任务分配", createAssignment: "创建任务分配", assignmentSearch: "分配记录 / 参与者 / 任务", allStatuses: "全部状态", taskVersion: "任务版本", due: "截止", statusSignals: "状态 / 信号", missing: "缺失", noAssignments: "尚无任务分配。", assignmentsBack: "返回任务分配", assignmentAuthorityHelp: "服务端会重新核对启用状态、授权、已发布版本和设备归属；下拉组合不构成授权。", publishedTaskVersion: "已发布任务版本", preferredDevice: "首选设备", noDevice: "不指定", locale: "语言区域", assignmentNote: "备注", creating: "创建中…", assignmentCreateFailed: "任务分配创建失败。", manage: "管理", collapse: "收起", operationReasonMin: "操作原因，至少 10 个字符", reasonMinError: "原因至少需要 10 个字符。", extendNeedsDue: "延期必须选择新的截止时间。", extend: "延期", operationFailed: "操作失败。",
    closeSession: "关闭录制会话", closeReason: "关闭原因，至少 10 个字符", closeReasonError: "关闭原因至少需要 10 个字符。", closing: "关闭中…", confirmClose: "确认关闭", closeSessionFailed: "录制会话关闭失败。",
    reviewKicker: "人工权威队列", reviewCases: "复核事项", reviewIntro: "自动证据只提示异常；业务关系由不可变匹配决定和人工原因决定。", allTypes: "全部类型", case: "事项", type: "类型", relatedObject: "关联对象", unresolvedParticipant: "尚未确定参与者", noDecision: "尚无决定", noMachineReason: "没有机器原因", noReviewCases: "当前筛选没有复核事项。", reviewBack: "返回复核队列", matchHistory: "匹配决定历史", noMatchDecisions: "尚无匹配决定。", viewUpload: "查看上传详情", transfer: "传输", metadata: "元数据", assignment: "任务分配", participantClaim: "参与者声明", supersedes: "替代 {value}", current: "当前", historical: "历史", unmatchedValue: "未匹配",
    humanAction: "人工操作", terminalReview: "此复核事项已终结；历史仍可查看。", reviewAction: "操作", confirmCurrentMatch: "确认当前匹配", correctSessionDevice: "纠正录制会话 / 设备", rejectUpload: "拒绝上传", requestRerecord: "要求重新录制", extendAssignment: "延长任务分配", suspendParticipant: "暂停参与者", resolveWithoutMatch: "不改变匹配并解决", dismissCase: "忽略复核事项", newDueAt: "新截止时间", changePreview: "变更预览", confirmBeforeSubmit: "提交前确认 · {subject}", before: "变更前", after: "变更后", chooseNewTime: "请选择新时间", reasonHelp: "说明判断证据与修改原因（10～500 字符）", reasonLengthError: "原因必须为 10～500 个字符。", retryReasonLengthError: "重试原因必须为 10～500 个字符。", reviewDecisionFailed: "复核决定失败。", metadataRetryFailed: "元数据重试失败。", submitImmutableDecision: "提交不可变决定", retryMetadata: "重试元数据",
    countryRegion: "国家 / 地区", timezone: "时区", currentValue: "现有值", chooseSuggestion: "请从 {field} 建议中选择一个值", searchField: "输入搜索 {field}", tablePagination: "表格分页", totalRows: "共 {count} 条 · 第 {page} / {pages} 页", rowsPerPage: "每页", rowsPerPageAria: "每页行数", rows: "{count} 行", apply: "应用", goToPage: "前往页码", goToPageRange: "前往页码，范围 1 到 {pages}", jump: "跳转", previousPage: "上一页", nextPage: "下一页",
    recordsKicker: "跨任务采集运营", records: "采集记录", recordsIntro: "集中查看视频上传、录制会话和关键操作；异常处理仍回到原有权威详情与待处理队列。", recordsSummary: "采集记录汇总", totalUploads: "全部上传", transfersInProgress: "传输处理中", openSessions: "未关闭会话", needsAttention: "需要关注", anomalyOverview: "异常概览", duplicateCandidate: "重复候选", totalReviews: "待复核总数", videoRecords: "视频记录", sessionRecords: "录制会话", recordsView: "采集记录视图",
    videoRecordsIntro: "按上传记录查看传输、元数据、匹配和人工复核状态。缺少上传会在上方异常概览中单独呈现。", searchVideoRecords: "搜索视频记录", videoSearchPlaceholder: "文件名、参与者、任务或录制会话", transferStatus: "传输状态", allTransferStatuses: "全部传输状态", metadataStatus: "元数据状态", allMetadataStatuses: "全部元数据状态", handlingStatus: "处理状态", allRecords: "全部记录", attentionOnly: "仅看待处理", clearFilters: "清除筛选", file: "文件", taskSession: "任务 / 录制会话", recordStatusColumns: "传输 / 元数据 / 匹配 / 复核", sizeTime: "大小 / 时间", taskPending: "任务待确定", claimed: "声明：", final: "最终：", notClaimed: "未声明", awaitingConfirmation: "待确认", noVideoRecordsFiltered: "当前筛选没有视频记录", noVideoRecordsFilteredHelp: "调整条件，或清除筛选查看全部上传。", noVideoRecordsHelp: "参与者创建录制并上传后，视频记录会显示在这里。", viewTasks: "查看采集任务",
    sessionsIntro: "默认聚焦未关闭会话；全部历史和已关闭会话仍可搜索，便于追溯数小时或数天后到达的视频。", searchSessions: "搜索录制会话", sessionSearchPlaceholder: "录制会话、参与者、任务或分配", sessionStatus: "会话状态", notClosed: "未关闭", allHistory: "全部历史", taskDevice: "任务 / 设备", markerVideos: "标记 / 视频", createdTime: "创建时间", closedAt: "关闭于 {date}", markerConfirmed: "标记已确认", markerPending: "标记待确认", matchedVideos: "匹配视频 {count} 个", viewRelatedVideos: "查看相关视频", noSessionsFiltered: "当前筛选没有录制会话", noOpenSessions: "当前没有未关闭会话", noSessionsFilteredHelp: "调整条件，或回到默认的未关闭会话列表。", noOpenSessionsHelp: "可以查看全部历史，追溯已关闭会话和晚到的视频。",
    auditRecordsIntro: "以本地化摘要呈现只读审计证据；原始动作、请求 ID 和变更 JSON 可按需展开。", searchActivity: "搜索操作记录", activitySearchPlaceholder: "对象 ID、原始动作或操作者", actionCategory: "动作分类", allActions: "全部动作", actor: "操作者", reasonChanges: "原因 / 变化摘要", time: "时间", noPublicId: "无公开 ID", noReason: "未填写原因", changedFields: "变更：{fields}", noBeforeAfterChanges: "没有变更前 / 变更后字段变化", viewChanges: "查看变更详情", rawAction: "原始动作：{value}", requestId: "请求 ID：{value}", noBeforeAfterJson: "没有变更前 / 变更后 JSON。", noActivityFiltered: "当前筛选没有操作记录", noActivityFilteredHelp: "调整条件，或清除筛选查看全部证据。", noActivityImmutableHelp: "关键操作发生后会自动写入不可变的审计记录。", categoryTask: "采集任务", categoryParticipant: "参与者与设备", categoryAssignment: "人员分配", categorySession: "录制会话", categoryUpload: "视频上传", categoryMetadata: "视频元数据", categoryReview: "匹配与复核", categorySystem: "系统与其他",
    uploadsBack: "返回上传列表", demoRetentionExpired: "演示对象留存已过期", matchDevice: "匹配 / 设备", objectClaim: "对象与参与者声明", uploadAttempts: "上传尝试", normalizedMetadata: "归一化元数据", metadataUnavailableIndependent: "元数据尚不可用；传输状态保持独立。", fieldEvidence: "字段证据", noAllowlistEvidence: "尚无白名单字段证据。", relatedReviews: "相关复核事项", noRelatedReviews: "没有相关复核事项。", claimedSession: "声明的录制会话", localModified: "本地修改时间", participantNote: "参与者备注", failureCode: "失败代码", verifiedAt: "验证时间", intentExpires: "上传意图过期时间", videoAsset: "视频资产", objectKey: "对象键", parser: "解析器", container: "容器", duration: "时长", video: "视频", audio: "音频", captureTime: "拍摄时间", camera: "相机", serialHmac: "序列号 HMAC", gpsPresent: "存在 GPS 元数据", projection360: "投影 / 360", extracted: "提取时间", channels: "{count} 声道", not360: "非 360", expires: "过期 {date}", ranges: "范围 {count}/24", fiveMinutePreview: "5 分钟私有预览", retryReason: "重试原因（10～500 字符）", previewFailed: "无法创建预览链接。",
    participantsBack: "返回参与者", consent: "授权", region: "地区", managementEmail: "管理邮箱", defaultDevice: "默认设备", participantProfile: "参与者资料", participantProfileHelp: "管理邮箱仅作内部记录，不发送真实邮件。备注不得填写敏感信息。", displayAlias: "显示别名", sensitiveNotesHelp: "最多 500 字；请勿写姓名、住址、证件号等敏感信息。", saveParticipant: "保存参与者资料", invitationAndStatus: "邀请与状态", invitationHashHelp: "邀请链接只显示一次；数据库仅保存 SHA-256 哈希。", currentInvitation: "当前邀请：{status}", notGenerated: "尚未生成", fixtureProtected: "受保护，公开管理员不能修改。", generateInvitation: "生成 / 重发邀请", generating: "生成中…", oneTimeInvitationUrl: "一次性邀请 URL", copyLink: "复制链接", openNewWindow: "新窗口打开", operationReason: "操作原因", minimum10: "至少 10 个字符", revokeInvitation: "撤销邀请", pauseParticipant: "暂停", reactivateParticipant: "恢复", withdrawParticipant: "退出研究", registerDevice: "登记设备", manufacturer: "制造商", model: "型号", deviceTypePhone: "手机", deviceTypeActionCamera: "运动相机", deviceTypeCamera: "相机", deviceTypeOther: "其他", serialHmacOnly: "序列号（只保存 HMAC）", firmware: "固件版本", setDefaultDevice: "设为默认设备", registering: "登记中…", updateReason: "修改原因（10～500 字符）", noDevices: "尚未登记设备。", invitationCreateFailed: "邀请生成失败。", invitationRevokeFailed: "邀请撤销失败。", statusChangeReasonError: "状态变更原因至少需要 10 个字符。", statusChangeFailed: "状态变更失败。", deviceCreateFailed: "设备登记失败。", participantUpdateFailed: "参与者更新失败。", deviceUpdateFailed: "设备更新失败。", createRegistryEntry: "创建登记记录", createParticipant: "创建参与者", createParticipantHelp: "先创建草稿，再生成一次性模拟邀请。真实邮件不在 MVP 范围内。", managementEmailNoSend: "管理邮箱（不发送邮件）", newNotesHelp: "最多 500 字，请勿填写姓名、电话等敏感信息。", creatingParticipant: "正在创建…", createDraftParticipant: "创建草稿参与者", participantCreateFailed: "创建参与者失败。",
    participantList: { kicker: "参与者登记", filters: "参与者筛选", allConsentStatuses: "全部授权状态", allLocales: "全部语言区域", allCountriesRegions: "全部国家 / 地区", allMissingSignals: "全部缺失状态", onlyMissing: "仅看缺失", excludeMissing: "排除缺失", allReviewSignals: "全部复核状态", onlyNeedsReview: "仅看待复核", excludeNeedsReview: "排除待复核" },
    participantDrawer: { viewAria: "查看 {id}", editAria: "编辑 {id}", viewTitle: "查看参与者", editTitle: "编辑参与者", viewSubtitle: "资料与当前登录凭据", editSubtitle: "更新基础资料", closeAria: "关闭参与者侧边栏", loadingProfile: "正在读取参与者资料…", reloadProfile: "重新加载", profileLoadFailed: "无法读取参与者资料，请重试。", profileNetworkFailed: "无法读取参与者资料，请检查网络后重试。", basicProfile: "基本资料", openFullDetails: "打开完整详情", fixture: "演示数据", loginInformation: "参与者登录信息", loginInformationHelp: "可重复查看和复制，仅用于参与者站点登录。", credentialMissing: "尚未生成", credentialPendingActivation: "等待激活", credentialPendingSync: "等待同步", credentialReady: "已同步", loginAddress: "登录地址", loginAccount: "帐号", copyAccount: "复制帐号", copyPassword: "复制密码", passwordUnavailable: "尚未生成可查密码。", pendingActivationHelp: "密码已生成，但参与者必须先接受邀请完成激活后才能登录。", pendingSyncHelp: "密码尚未完成认证同步。请先继续同步，再把登录信息交给参与者。", readyBlockedHelp: "密码已同步，但当前参与者状态或授权不允许登录。", readyCanLogin: "当前凭据可以直接登录。", fullLoginInformation: "登录地址：{url}\n帐号：{account}\n密码：{password}", copyFullLoginInformation: "复制完整登录信息", copied: "{label}已复制。", copyFailed: "复制失败，请选中文本后手动复制。", generatePassword: "生成登录密码", continueSync: "继续同步", resetPassword: "重置登录密码", confirmGeneratePassword: "确定为该参与者生成登录密码吗？", confirmSyncPassword: "确定继续把当前密码同步到参与者登录帐号吗？", confirmResetPassword: "确定重置登录密码吗？旧密码会立即失效。", processing: "处理中…", credentialOperationFailed: "登录密码操作失败，请重试。", credentialNetworkFailed: "登录密码操作失败，请检查网络后重试。", credentialSynced: "密码已同步。", credentialGenerated: "新的登录密码已生成。旧密码已失效。", fixtureCredentialProtected: "演示数据受保护，公开管理员不能生成或重置密码。", fixtureEditProtected: "演示数据受保护，公开管理员可以查看，但不能保存修改。", profileConflict: "资料已被其他操作更新，已重新加载最新内容。请确认后再次保存。", profileUpdateFailed: "参与者更新失败，请重试。", profileUpdateNetworkFailed: "参与者更新失败，请检查网络后重试。", saveChanges: "保存修改" },
    removeItem: "移除{label} {number}", enterCustomOption: "请输入自定义选项", alreadyAdded: "“{value}”已经添加", maxItems: "最多添加 {count} 项", selectedLabel: "已选{label}", removeValue: "从{label}中移除“{value}”", nothingAdded: "尚未添加。", addFromPreset: "从预设中添加", choosePreset: "选择一个预设选项", addCustomOption: "添加自定义选项", addCustom: "添加自定义{label}", add: "添加",
    removeModule: "移除{title}模块", taskDraftSaveFailed: "无法保存任务草稿，请检查内容后重试。", taskDraftSaved: "任务草稿已保存。", serverConnectionFailed: "无法连接服务器。请检查网络后重试。", taskPublishFailed: "无法发布任务版本，请稍后重试。", versionPublished: "已发布版本 {version}。", basicInformation: "基础信息", basicInformationHelp: "参与者会先看到标题、描述和目标录制规格。标有 * 的字段为必填。", taskTitle: "任务标题 *", taskTitleExample: "例如：制作一杯咖啡", taskDescription: "任务描述 *", taskDescriptionHelp: "说明参与者需要完成什么，以及任务完成后的预期结果。", recordingSpec: "录制规格", recordingSpecHelp: "这些值用于参与者说明，并作为上传后元数据校验的目标。", targetDurationMinutes: "目标录制时长（分钟）*", durationToleranceMinutes: "允许时长误差（± 分钟）*", targetResolution: "目标分辨率 *", customResolution: "自定义分辨率…", customResolutionLabel: "自定义分辨率", resolutionExample: "例如：1440p", targetFps: "目标帧率（FPS）*", customFps: "自定义帧率…", customFpsLabel: "自定义帧率", taskModulesHelp: "按需添加说明模块；参与者端会按固定顺序展示非空模块。", addInstructionModule: "添加说明模块",
    moduleEnvironment: "环境与活动范围", moduleSteps: "具体执行步骤", moduleObjects: "必需物品", moduleMustShow: "必须展示", moduleMustAvoid: "必须避开", moduleConstraints: "其他录制约束", moduleCompletion: "完成判定标准", moduleUpload: "上传说明", modulePrivacy: "隐私检查清单", environmentModuleHelp: "说明录制前的环境准备，以及活动可以发生的范围。", environmentExample: "例如：保持厨房台面光线充足", addEnvironment: "添加环境准备", areaLimit: "活动范围限制", areaExample: "例如：活动范围限制在厨房内", addAreaLimit: "添加范围限制", stepsHelp: "步骤顺序会直接展示给参与者；预期画面用于说明每一步应留下什么视觉证据。", stepNumber: "步骤 {number}", moveStepUp: "上移步骤 {number}", moveStepDown: "下移步骤 {number}", deleteStep: "删除步骤 {number}", operationInstruction: "操作说明 *", operationInstructionHelp: "描述参与者在这一步需要完成的操作", expectedVisualEvidence: "预期画面证据", cupExample: "例如：咖啡杯", addStep: "添加步骤", objectsHelp: "列出完成任务需要的物品，并标明物品是否必须出现在摄像机画面中。", objectName: "物品名称 *", coffeeMakerExample: "例如：咖啡机", mustBeVisible: "必须入镜", deleteObject: "删除必需物品 {number}", addObject: "添加物品", mustShowHelp: "选择画面中必须持续或明确出现的内容。", processExample: "例如：咖啡制作过程", mustAvoidHelp: "选择不能出现在画面中的隐私信息、反射或无关内容。", billExample: "例如：家庭账单", constraintsHelp: "补充无法简单归类为必须展示或必须避开的执行限制。", recordingConstraint: "录制约束", constraintExample: "例如：全程保持头部朝向操作区域", addConstraint: "添加录制约束", completionHelp: "元数据用于文件与技术规格检查；内容是否完成仍由研究人员人工审核。", criterionDescription: "判定说明 *", criterionExample: "例如：咖啡已经完成冲泡", validationMethod: "检查方式", manualReviewLabel: "人工审核", metadataCheckLabel: "元数据检查", deleteCriterion: "删除完成判定标准 {number}", addCriterion: "添加判定标准", uploadModuleHelp: "说明视频可能存放在哪里、如何上传，以及网络中断后如何恢复。", allowedFileSources: "允许的文件来源 *", cameraStorage: "摄像机内部存储", uploadOperationInstructions: "上传操作说明", uploadOriginalExample: "例如：选择摄像机生成的原始文件", addUploadInstruction: "添加上传说明", recoveryInstructions: "中断恢复说明", recoveryExample: "例如：重新选择同一文件并继续上传", addRecoveryInstruction: "添加恢复说明", privacyHelp: "参与者在上传前需要逐项确认的隐私要求。", checklistItem: "检查项", privacyExample: "例如：画面中没有私人照片", addPrivacyItem: "添加隐私检查项", noInstructionModules: "尚未添加任务说明模块", noInstructionModulesHelp: "使用“添加说明模块”补充环境、步骤、画面要求和上传说明。", systemRecordingRules: "系统录制与匹配规则", firstPersonRule: "使用头戴式设备录制第一人称视角视频。", authorityRule: "参与者、任务版本与设备从任务分配和录制会话推导，不由文件名决定。", creatingDraft: "创建草稿中…", savingDraft: "保存草稿中…", createDraft: "创建草稿", saveDraft: "保存草稿", publishingVersion: "发布版本中…", saveDraftFirst: "先保存草稿", publishNewVersion: "发布新版本",
    presetHands: "参与者双手", presetProcess: "完整操作过程", presetTools: "使用中的工具", presetInitialEnvironment: "任务开始前的环境", presetResult: "任务完成后的结果", presetFace: "人脸", presetMirror: "镜子", presetId: "证件", presetAddress: "住址", presetNotifications: "屏幕通知", presetPhotos: "私人照片", presetLocation: "定位信息", presetObject: "操作对象", presetInitialState: "任务开始状态",
    validationInvalid: "请检查此字段并重试。", validationTolerance: "允许误差必须小于目标录制时长", validationStepOrder: "录制步骤必须从 1 开始连续排序", validationCodeUnique: "代码必须唯一", validationOverlap: "同一内容不能同时属于必须展示和必须避开",
    chooseDueError: "请选择新的截止时间。", chooseReplacementError: "请选择替代参与者。", replace: "替换", stop: "停止", replaceParticipant: "替换参与者", stopParticipation: "停止参与", adjustDue: "调整截止时间", closePeopleManager: "关闭人员管理窗口", participantStats: "版本 {version} · 会话 {sessions} · 视频 {videos}", replaceHistoryHelp: "替换只会停止原参与者的后续操作。已有录制会话、上传和视频仍归原参与者，不会转移。", replacementParticipant: "替代参与者", chooseAvailableParticipant: "选择一名可用参与者", sameAsOriginal: "与原记录一致", newDue: "新截止时间", noDeviceSpecified: "不指定设备", cancelHistoryHelp: "停止后将关闭开放的录制会话，并禁止创建新的录制会话和上传。最后一名参与者不能单独停止，请使用替换操作。", reasonPlaceholder: "说明调整原因，至少 10 个字符", processing: "正在处理…", stopAndAssign: "停止 {name} 并分配", saveNewDue: "保存新截止时间", removeFromRoster: "从发布名单移除", closeRemoveParticipant: "关闭移除参与者窗口", removeRosterHelp: "该任务尚未发布，因此还没有生成分配、录制会话或上传记录。移除后，也可以再次添加或换成其他参与者。", removing: "正在移除…", confirmRemove: "确认移除", remove: "移除", rosterRemoveFailed: "无法从发布名单移除，请重试。",
    regionFilterAll: "筛选地区，当前为全部地区", regionFilterSelected: "筛选地区，已选择 {count} 个地区", regionLabel: "地区", allRegions: "全部地区", selectedCount: "已选 {count} 项", regionOptions: "地区选项", noRegions: "暂无地区数据", clearRegionFilter: "清空地区筛选", alreadyInRoster: "已在发布名单中", alreadyInTask: "已在当前任务中", participantInactive: "参与者未启用", consentInvalid: "授权状态无效", eligible: "可以分配", chooseParticipantError: "请至少选择一名参与者。", addParticipantFailed: "无法添加参与者，请检查网络后重试。", addParticipants: "添加参与者", addParticipantsIntro: "一次选择一人或多人；每个人都会获得独立的任务记录。", closeAddParticipants: "关闭添加参与者窗口", addParticipantsSteps: "添加参与者步骤", choosePeople: "选择人员", choosePeopleComplete: "选择人员，已完成", devicesAndSettings: "设备与设置", joinedRoster: "已加入发布名单 · {count} 人", participantsAdded: "成功添加 {count} 名参与者", participantsSkipped: "{count} 人未添加", shownSelected: "显示 {shown} 人，已选择 {selected} 人", searchParticipants: "搜索参与者", participantSearchPlaceholder: "搜索姓名、编号或地区", chooseName: "选择 {name}", noParticipantMatches: "没有匹配的参与者。请修改搜索内容。", devicesSettingsHelp: "为已选择的 {count} 名参与者确认设备，并填写本次公共设置。", sharedSettings: "公共设置", sharedSettingsHelp: "以下内容会应用到本次选择的所有人。", latest: "最新", draftRosterHelp: "当前任务仍是草稿。参与者会先加入发布名单；首次发布时，系统会把名单绑定到冻结的版本并生成正式分配。", assignmentNotes: "分配备注", visibleOptional: "选填，参与者可看到", perPersonDevice: "每人设备", deviceOptionalHelp: "设备可以留空；有默认设备时已自动带入。", selectedPeople: "已选择 {count} 人", done: "完成", nextSettings: "下一步：设备与设置", previousStep: "上一步", joining: "正在加入…", assigning: "正在分配…", joinRoster: "加入发布名单", assignCount: "分配给 {count} 人",
  },
  labels: {
    taskOperational: { draft: "草稿", awaiting_participants: "待分配", running: "进行中", needs_attention: "需要处理", completed: "已完成", archived: "已归档" },
    matchDecision: { participant_claim: "参与者声明", admin_confirmed: "管理员已确认", admin_corrected: "管理员已纠正", unmatched: "尚未匹配", rejected: "匹配已拒绝", pending: "等待匹配" },
    deviceConsistency: { matched: "一致", partial_match: "部分一致", metadata_unavailable: "元数据不可用", model_mismatch: "型号不一致", serial_mismatch: "序列号不一致", metadata_conflict: "元数据冲突" },
    captureTimeSource: { quicktime_with_timezone: "QuickTime（含时区）", container: "容器", track: "视频轨道", local_modified: "本地修改时间", unknown: "未知" },
    recordHealth: { attention: "需要处理", ready: "已就绪", progress: "处理中" },
    reviewCaseType: { missing: "缺少上传", upload_failed: "上传失败", metadata_failed: "元数据失败", duplicate_candidate: "疑似重复", unmatched: "尚未匹配", device_mismatch: "设备不一致", needs_review: "需要复核" },
    auditAction: { "assignment.acknowledged": "确认采集任务", "assignment.canceled": "取消人员分配", "assignment.created": "创建人员分配", "assignment.extended": "延长截止时间", "assignment.replaced": "替换参与者", "demo.baseline_repaired": "修复演示基线", "demo.retention_deleted": "清理演示留存数据", "device.updated": "更新采集设备", "metadata.extracted": "完成元数据解析", "metadata.extraction_failed": "元数据解析失败", "participant.created": "创建参与者", "participant.device_created": "登记参与者设备", "participant.invitation_accepted": "接受参与邀请", "participant.invitation_expired": "参与邀请过期", "participant.invitation_generated": "生成参与邀请", "participant.invitation_revoked": "撤销参与邀请", "participant.updated": "更新参与者", "participant.suspended": "暂停参与者", "participant.withdrawn": "参与者退出", "session.closed": "关闭录制会话", "session.created": "创建录制会话", "session.marker_acknowledged": "确认录制标记", "session.marker_regenerated": "重新生成录制标记", "task.created": "创建任务", "task.draft_updated": "更新任务草稿", "task.participant_planned": "加入草稿发布名单", "task.participant_unplanned": "移出草稿发布名单", "task.participants_added": "批量添加参与者", "task.published": "发布任务版本", "upload.aborted": "中止视频上传", "upload.expired": "视频上传过期", "upload.reconciliation_failed": "视频上传核对失败", "upload.verified": "视频上传验证完成", "upload_attempt.created": "创建上传尝试", "upload_batch.created": "创建上传批次", "upload_intent.created": "创建视频上传", "review_case.confirm_match": "确认视频匹配", "review_case.correct_match": "纠正视频匹配", "review_case.reject_upload": "拒绝视频上传", "review_case.request_rerecord": "要求重新录制", "review_case.extend_assignment": "延长采集截止时间", "review_case.suspend_participant": "暂停参与者", "review_case.resolve_case": "完成视频复核", "review_case.dismiss_case": "忽略复核事项" },
    entity: { assignment: "人员分配", device: "采集设备", metadata: "视频元数据", participant: "参与者", recording_session: "录制会话", review_case: "复核事项", task: "采集任务", upload_attempt: "上传尝试", upload_batch: "上传批次", upload_intent: "视频上传", video_asset: "视频资产" },
    field: { participantPublicId: "参与者", replacementParticipantPublicId: "替代参与者", taskPublicId: "采集任务", taskVersion: "任务版本", dueAt: "截止时间", status: "状态", preferredDevicePublicId: "首选设备", sessionPublicId: "录制会话", devicePublicId: "设备" },
  },
  state: {
    "participant.status": { draft: "草稿", invited: "已邀请", expired: "已过期", active: "启用", suspended: "已暂停", withdrawn: "已退出" },
    "participant.consent_status": { pending: "待授权", valid: "有效", expired: "已过期", withdrawn: "已撤回" },
    "participant_invitation.status": { generated: "已生成", opened: "已打开", accepted: "已接受", revoked: "已撤销", expired: "已过期" },
    "consent_record.status": { accepted: "已接受", withdrawn: "已撤回", expired: "已过期" },
    "device.status": { active: "启用", lost: "遗失", retired: "已退役", shared: "共享" },
    "task.lifecycle": { draft: "草稿", active: "进行中", archived: "已归档" },
    "assignment.status": { assigned: "已分配", acknowledged: "已确认", session_created: "已创建会话", uploading: "上传中", submitted: "已提交", needs_review: "需要复核", rework_required: "需要重做", accepted: "已接受", expired: "已过期", missing_upload: "缺少上传", canceled: "已取消" },
    "recording_session.status": { open: "开放", closed: "已关闭" },
    "upload_batch.status": { open: "开放", completed: "已完成", aborted: "已中止", expired: "已过期" },
    "upload_intent.transfer_status": { created: "已创建", uploading: "上传中", reconciling: "核对中", verified: "已验证", failed: "失败", aborted: "已中止", expired: "已过期" },
    "upload_intent.metadata_status": { pending: "等待处理", processing: "处理中", extracted: "已提取", partial: "部分提取", unsupported: "不支持", failed: "失败" },
    "upload_attempt.status": { created: "已创建", uploading: "上传中", paused: "已暂停", completed: "已完成", failed: "失败", aborted: "已中止", expired: "已过期" },
    "video_asset.status": { active: "启用", rejected: "已拒绝", deleted: "已删除" },
    "metadata_attempt.status": { processing: "处理中", extracted: "已提取", partial: "部分提取", unsupported: "不支持", failed: "失败" },
    "review_case.status": { open: "开放", in_review: "复核中", resolved: "已解决", dismissed: "已忽略" },
  },
  stateAction: {
    "participant.status": { invite: "发送邀请", expireInvitation: "标记邀请过期", acceptInvitation: "接受邀请", suspend: "暂停", resume: "恢复", withdraw: "退出" },
    "participant.consent_status": { accept: "接受授权", expire: "标记过期", withdraw: "撤回授权" },
    "participant_invitation.status": { open: "打开", accept: "接受", revoke: "撤销", expire: "标记过期" },
    "consent_record.status": {},
    "device.status": { markLost: "标记遗失", share: "设为共享", activate: "启用", retire: "退役" },
    "task.lifecycle": { publish: "发布", archive: "归档" },
    "assignment.status": { acknowledge: "确认", createSession: "创建会话", startUpload: "开始上传", submit: "提交", requireReview: "要求复核", requestRework: "要求重做", accept: "接受", expire: "标记过期", markMissing: "标记缺失", extendUnacknowledged: "延期", extendAcknowledged: "延期", cancel: "取消" },
    "recording_session.status": { close: "关闭" },
    "upload_batch.status": { complete: "完成", abort: "中止", expire: "标记过期" },
    "upload_intent.transfer_status": { start: "开始", reconcile: "核对", verify: "验证", fail: "标记失败", abort: "中止", expire: "标记过期" },
    "upload_intent.metadata_status": { start: "开始处理", extract: "完成提取", partial: "标记部分提取", markUnsupported: "标记不支持", fail: "标记失败", retry: "重试" },
    "upload_attempt.status": { start: "开始", pause: "暂停", complete: "完成", fail: "标记失败", abort: "中止", expire: "标记过期" },
    "video_asset.status": { reject: "拒绝", delete: "删除" },
    "metadata_attempt.status": { extract: "完成提取", partial: "标记部分提取", markUnsupported: "标记不支持", fail: "标记失败" },
    "review_case.status": { beginReview: "开始复核", resolve: "解决", dismiss: "忽略" },
  },
  errors: {
    ACTIVE_ASSIGNMENT_EXISTS: "该参与者已在当前任务中。",
    ACTIVE_UPLOAD_LIMIT: "活跃上传数量已达到上限。",
    ASSIGNMENT_REQUIRED: "需要关联任务分配记录。",
    AUTH_REQUIRED: "请先登录。",
    CONSENT_REQUIRED: "需要有效授权。",
    CONTENT_HASH_MISMATCH: "任务内容已发生变化，请刷新后重试。",
    CURRENT_ASSIGNMENT_EXISTS: "替代参与者已在当前任务中。",
    DEMO_PARTICIPANT_LIMIT: "演示参与者数量已达到上限。",
    DEVICE_NOT_AVAILABLE: "所选设备当前不可用。",
    DUE_AT_IN_PAST: "截止时间必须晚于当前时间。",
    FILE_TOO_LARGE: "文件超过允许的大小。",
    FIXTURE_PROTECTED: "公开演示数据不可修改。",
    FORBIDDEN: "你没有权限执行此操作。",
    IDEMPOTENCY_KEY_REQUIRED: "请求缺少幂等键。",
    IDEMPOTENCY_KEY_REUSED: "该请求键已用于其他操作。",
    INTERNAL_ERROR: "服务暂时无法处理请求。",
    INVALID_ASSIGNMENT_STATE: "当前任务分配状态不允许此操作。",
    INVALID_CREDENTIALS: "账号或密码不正确。",
    INVALID_DEVICE_STATE: "当前设备状态不允许此操作。",
    INVALID_PARTICIPANT_STATE: "当前参与者状态不允许此操作。",
    INVITATION_ACCEPT_FAILED: "暂时无法接受邀请。",
    INVITATION_INVALID_OR_EXPIRED: "邀请无效或已过期。",
    INVITATION_NOT_ACTIVE: "邀请已失效。",
    MARKER_NOT_FOUND: "未找到录制标记。",
    MATCH_DECISION_REQUIRED: "需要当前匹配决定。",
    METADATA_ALREADY_PROCESSING: "元数据正在处理中。",
    METADATA_ATTEMPT_LIMIT: "元数据处理重试次数已达到上限。",
    METADATA_RETRY_COOLDOWN: "请稍后再重试元数据处理。",
    NOT_FOUND: "未找到请求的资源。",
    ORIGIN_REJECTED: "请求来源无效。",
    PARTICIPANT_NOT_ELIGIBLE: "当前参与者不符合操作条件。",
    PARTICIPANT_REQUIRED: "需要关联参与者。",
    REVIEW_CASE_TERMINAL: "该复核项目已经处理。",
    SAME_PARTICIPANT: "请选择另一名参与者。",
    SESSION_CLOSED: "录制会话已关闭。",
    SESSION_NOT_AVAILABLE: "录制会话当前不可用。",
    SESSION_REQUIRED: "请选择录制会话。",
    SIGNED_URL_FAILED: "暂时无法创建预览链接。",
    SIZE_MISMATCH: "上传文件大小与声明不一致。",
    STALE_ASSIGNMENT_STATE: "任务分配状态已变化，请刷新后重试。",
    STALE_MATCH_DECISION: "匹配决定已被其他操作更新。",
    STALE_PARTICIPANT_STATE: "参与者状态已变化，请刷新后重试。",
    STALE_REVIEW_CASE_STATE: "复核状态已变化，请刷新后重试。",
    STALE_UPLOAD_ATTEMPT_STATE: "上传尝试状态已变化，请刷新后重试。",
    STALE_UPLOAD_STATE: "上传状态已变化，请刷新后重试。",
    STALE_VIDEO_ASSET_STATE: "视频素材状态已变化，请刷新后重试。",
    STALE_WRITE: "数据已被其他操作更新，请刷新后重试。",
    STORAGE_MISSING: "存储对象不存在。",
    STORAGE_OBJECT_NOT_VERIFIED: "上传对象尚未验证。",
    STORAGE_SIGNATURE_FAILED: "暂时无法创建上传凭据。",
    TASK_ARCHIVED: "已归档任务不能执行此操作。",
    TASK_REQUIRES_PARTICIPANT: "任务必须至少保留一名参与者。",
    UPLOAD_ATTEMPT_EXPIRED: "上传尝试已过期。",
    UPLOAD_ATTEMPT_LIMIT: "该文件的重试次数已达到上限。",
    UPLOAD_ATTEMPT_REQUIRED: "需要有效的上传尝试。",
    UPLOAD_ATTEMPT_TERMINAL: "该上传尝试已经结束。",
    UPLOAD_BATCH_CLOSED: "上传批次已关闭。",
    UPLOAD_BATCH_LIMIT: "该批次的文件数量已达到上限。",
    UPLOAD_DAILY_QUOTA: "最近 24 小时的上传量已达到上限。",
    UPLOAD_NOT_VERIFIED: "上传尚未验证完成。",
    UPLOAD_PROGRESS_INVALID: "上传进度无效。",
    UPLOAD_PROGRESS_OVERFLOW: "上传进度超过文件大小。",
    UPLOAD_PROGRESS_REGRESSION: "上传进度不能后退。",
    UPLOAD_TERMINAL: "该上传已经结束。",
    VALIDATION_FAILED: "输入信息不完整或格式不正确。",
    VIDEO_ASSET_REQUIRED: "需要关联视频素材。",
    UNKNOWN: "操作失败，请稍后重试。",
  },
} as const;

type MessageSchema<T> = { [K in keyof T]: T[K] extends string ? string : MessageSchema<T[K]> };
export type I18nCatalog = MessageSchema<typeof zhCN>;

const japaneseIdentifierTokens: Record<string, string> = {
  abort: "中止", aborted: "中止済み", accept: "承諾", accepted: "承諾済み", acknowledged: "確認済み", active: "有効", added: "追加済み", already: "処理中", archived: "アーカイブ済み", asset: "アセット", assignment: "割り当て", attempt: "試行", auth: "認証", available: "利用可能", baseline: "基準データ", batch: "バッチ",
  canceled: "キャンセル", case: "案件", closed: "終了", confirm: "確認", consent: "同意", content: "内容", cooldown: "待機時間", correct: "修正", created: "作成",
  credentials: "認証情報", current: "現在", daily: "1 日", decision: "判断", demo: "デモ", device: "機器",
  deleted: "削除済み", dismiss: "対象外", draft: "下書き", due: "期限", eligible: "対象", error: "エラー", exists: "存在", expired: "期限切れ", extend: "延長", extended: "延長済み", extracted: "抽出", extraction: "抽出",
  failed: "失敗", file: "ファイル", fixture: "デモデータ", forbidden: "権限不足", found: "検出", generated: "生成", hash: "ハッシュ", idempotency: "冪等性",
  intent: "意図", internal: "内部", invalid: "無効", invitation: "招待", key: "キー", large: "大容量", limit: "上限",
  marker: "マーカー", match: "照合", metadata: "メタデータ", mismatch: "不一致", missing: "不足", not: "未",
  object: "オブジェクト", opened: "開封", origin: "送信元", overflow: "超過", participant: "参加者", participants: "参加者", past: "過去", planned: "計画済み",
  processing: "処理", progress: "進捗", protected: "保護", published: "公開", quota: "上限", reconciliation: "照合", regenerated: "再生成済み", reject: "拒否", repaired: "修復済み", replaced: "交代済み", request: "要求", rerecord: "再録画", retention: "保持期間",
  regression: "後退", rejected: "拒否", required: "必須", requires: "必須", resolve: "解決", resolved: "解決", retry: "再試行", reused: "再利用", review: "レビュー", revoked: "取消",
  same: "同一", session: "セッション", signature: "署名", signed: "署名済み", size: "サイズ", stale: "更新競合", state: "状態", storage: "ストレージ", suspend: "停止", suspended: "停止",
  task: "タスク", terminal: "終了済み", too: "超過", unavailable: "利用不可", unknown: "不明", unplanned: "計画解除", updated: "更新済み", upload: "アップロード",
  url: "URL", validation: "入力検証", verified: "検証", video: "動画", withdrawn: "辞退", write: "書き込み",
};

function japaneseIdentifierLabel(identifier: string): string {
  return identifier.toLowerCase().split(/[._]/).filter(Boolean).map((token) => japaneseIdentifierTokens[token] ?? token).join("・");
}

function japaneseErrorMessage(code: keyof typeof zhCN.errors): string {
  const common: Partial<Record<keyof typeof zhCN.errors, string>> = {
    AUTH_REQUIRED: "先にログインしてください。",
    FORBIDDEN: "この操作を行う権限がありません。",
    INTERNAL_ERROR: "現在リクエストを処理できません。しばらくしてから再試行してください。",
    INVALID_CREDENTIALS: "アカウントまたはパスワードが正しくありません。",
    NOT_FOUND: "指定された情報が見つかりません。",
    ORIGIN_REJECTED: "リクエストの送信元が無効です。",
    VALIDATION_FAILED: "入力内容が不足しているか、形式が正しくありません。",
    UNKNOWN: "操作に失敗しました。しばらくしてからもう一度お試しください。",
  };
  return common[code] ?? `${japaneseIdentifierLabel(code)}のため、この操作を完了できません。`;
}

// Catalogs intentionally share the exact Chinese schema. TypeScript rejects missing
// or additional keys here; the recursive parity test guards values loaded at runtime.
const en = {
  ...zhCN,
  meta: { adminTitle: "EgoCapture — Research operations", adminDescription: "Manage participants, collection tasks, recording sessions, uploads, and human review.", participantTitle: "EgoCapture — Participant portal", participantDescription: "View egocentric-video tasks, create recording sessions, and upload footage securely." },
  language: { label: "Language", zhCN: "简体中文", en: "English", ja: "日本語", changing: "Changing language…", changeFailed: "Could not change language. Try again." },
  common: { ...zhCN.common, admin: "Admin", participant: "Participant", loading: "Loading…", saving: "Saving…", submitting: "Submitting…", cancel: "Cancel", close: "Close", confirm: "Confirm", continue: "Continue", save: "Save", edit: "Edit", delete: "Delete", retry: "Retry", refresh: "Refresh", back: "Back", next: "Next", previous: "Previous", view: "View", details: "Details", status: "Status", actions: "Actions", createdAt: "Created", updatedAt: "Updated", dueAt: "Due", expiresAt: "Expires", name: "Name", email: "Email", notes: "Notes", device: "Device", reason: "Reason", optional: "Optional", default: "Default", none: "None", unknown: "Unknown", notAvailable: "Not available", yes: "Yes", no: "No", files: { one: "{count} file", other: "{count} files" }, bytes: "{value} bytes", version: "Version {value}", pageOf: "Page {page} of {pages}", empty: "No data yet." },
  nav: { adminPrimary: "Primary admin navigation", allFeatures: "All admin features", overview: "Overview", tasks: "Collection tasks", participants: "Participants", review: "Review queue", records: "Collection records", systemGuide: "System guide", videoOperations: "Video collection operations", participantNav: "Participant navigation", myTasks: "Tasks", uploads: "Uploads", logout: "Sign out", loggingOut: "Signing out…" },
  auth: { adminAccount: "Admin account", participantId: "Participant ID", password: "Password", passwordHint: "At least 10 characters", verifying: "Verifying…", enterAdmin: "Open admin console", enterParticipant: "Open my tasks", loginFailed: "Sign-in failed. Try again later.", networkFailed: "Could not reach the service. Check your connection and try again.", adminHeading: "Research operations", adminIntro: "Manage participants, tasks, recording sessions, uploads, and human review.", participantHeading: "Participant portal", participantIntro: "View tasks, create recording sessions, and upload egocentric video securely.", adminAccess: "Admin access", adminHeadline: "Turn every collection into traceable research evidence.", adminAudit: "One audit trail for participants, tasks, uploads, and review", authorizedOnly: "For authorized research operations staff only.", separated: "The admin console and participant portal are completely separated.", fieldOperation: "Field operation", participantQuote: "Record the moment carefully so the real process can be seen.", privateStorage: "Private object storage", appendAudit: "Append-only audit", demoSynthetic: "Use synthetic identities and non-sensitive video in this demo only.", participantAccess: "Participant access", participantContinue: "Continue your collection tasks", participantLoginHelp: "Sign in with the PT-prefixed Participant ID from your invitation. The admin console uses a separate domain." },
  shell: { errorTitle: "Something went wrong", errorBody: "This page cannot be displayed right now. Try again.", notFoundTitle: "Page not found", notFoundBody: "The page may have moved, or you may not have access.", backHome: "Back to home", safeFailure: "Safe failure", adminErrorTitle: "The console did not load", adminErrorBody: "No business data was changed. Try again later.", participantErrorTitle: "This page did not load", participantErrorBody: "No business data was changed. Try again, or go back if the problem continues.", reload: "Reload", adminNotFoundTitle: "This admin route does not exist", participantNotFoundTitle: "This collection route does not exist", participantNotFoundBody: "The link may have expired, or your account may not have access.", loadingAdmin: "Loading admin page", loadingParticipant: "Loading participant page" },
  participantUi: {
    homePlatform: "Egocentric video collection platform", loginWorkbench: "Sign in", heroLine1: "Capture what happened.", heroLine2: "Keep every clip traceable.", heroBody: "Participants record and upload against published tasks. Research teams can inspect task versions, recording sessions, upload progress, and review outcomes at any time.", viewWorkflow: "View the three-step workflow", demoWarning: "Do not use real identities or upload sensitive video in the demo. Complete informed-consent and data-governance procedures before real collection.", proofKicker: "More than storage: traceability", proofHeading: "The source and processing state of every video can be verified.", proofVersion: "Fixed task version", proofVersionBody: "Draft edits cannot change work already started", proofMarker: "Signed session marker", proofMarkerBody: "Connects a recording to its collection session", proofResume: "Resumable upload", proofResumeBody: "Continue after a pause or interruption", proofDirect: "Direct private upload", proofDirectBody: "Video bypasses the application server", workflowKicker: "Collect in three steps", workflowHeading: "Participants follow clear steps while researchers see progress.", workflowBody: "Participants follow the on-screen guidance; the system records task versions, sessions, upload state, and review outcomes.", workflow1Title: "Confirm the collection task", workflow1Body: "Read the published instructions before starting. Later draft edits do not change the version assigned to you.", workflow2Title: "Create a recording session", workflow2Body: "Create a session before recording and generate a signed marker with no personal information to identify the task.", workflow3Title: "Choose a session and upload", workflow3Body: "Choose the matching session, then upload. Uploads can pause and resume; suspicious or duplicate files go to human review and are not deleted automatically.", footerHeading: "Sign in to collect or manage tasks.", footerBody: "Participants use the Participant ID in their invitation; admins use their work email.", previewReady: "Ready", previewAria: "Session status preview", previewDemo: "Demo session", previewActivity: "Daily activity collection", previewMarker: "Session marker", previewMarkerReady: "Signed and ready to record", previewNoIdentity: "Contains no personal identity", previewTaskVersion: "Task version", previewFrozen: "Frozen", previewSessionMarker: "Session marker", previewGenerated: "Generated", previewUploadStatus: "Upload status", previewAwaitRecording: "Awaiting recording", tasksKicker: "Participant field app", greeting: "Hello, {name}", tasksImmutable: "Each task is fixed to its published version. Later draft edits do not change the instructions you received.", uploadRecordedFiles: "Upload recordings", noAssignments: "No tasks are currently assigned to you.", myTasks: "My tasks", targetDuration: "Target duration: {duration} (±{tolerance})", environmentAndArea: "Environment and activity area", environmentSetup: "Environment setup", areaConstraints: "Activity area", requiredObjects: "Required objects", mustBeVisible: "Must be visible", needNotBeVisible: "No need to show deliberately", recordingSteps: "Recording steps", expectedEvidence: "Expected evidence: {evidence}", defaultRecordingInstruction: "Complete the activity as described and keep recording continuously.", mustShow: "Must show", mustAvoid: "Must avoid", otherRecordingConstraints: "Other recording constraints", targetSpec: "Target specification: ", firstPersonView: "Head-mounted first-person view", sessionMarker: "Session marker: ", markerRequired: "Show for at least {seconds} seconds", markerOptional: "Optional", uploadAndRecovery: "Upload and recovery", allowedSources: "Allowed sources: ", uploadInstructions: "Upload instructions", recoveryInstructions: "Resume after interruption", fileTaskMatching: "Match files to tasks", completionCriteria: "Completion criteria", manualReview: "Human review", metadataCheck: "Metadata check after upload", privacyCheck: "Privacy check", acknowledgedVersion: "Acknowledged version: {value}", showQrCode: "Show QR code", markerAcknowledged: "Acknowledged", markerPending: "Pending", uploadVideo: "Upload video", sourceCamera: "Camera / action camera", sourceSsd: "External SSD", sourceMobile: "Phone", sourceDesktop: "Computer", sourceOther: "Other external storage", createSession: "Create recording session", createSessionBody: "Choose the device actually used for this recording. The server derives the participant and task version from the assignment.", contactAdminDevice: "Ask an admin to register a device first.", sessionCreateFailed: "Could not create the recording session.", defaultDevice: "Default", creating: "Creating…", createSessionAndMarker: "Create session and show marker", acknowledging: "Acknowledging…", acknowledgeVersion: "I have read and acknowledge this version", acknowledgementFailed: "Could not acknowledge the task.", uploadFiles: "Upload files", signedMarker: "Signed session marker", validUntil: "Valid until {date}", markerQrAlt: "Signed QR code for recording session {session}", shortCode: "Short code", markerPrivacy: "The QR code contains only session, assignment, device public ID, time, nonce, and an Ed25519 signature. It contains no name or email.", downloadQr: "Download QR code", generating: "Generating…", regenerateMarker: "Regenerate marker", markerConfirming: "Confirming…", markerCaptured: "I recorded the QR code", markerConfirmedAt: "Confirmed: {date}", sessionClosed: "Session closed", markerActionFailed: "Marker operation failed.", directUpload: "Direct TUS upload", uploadPageBody: "Video bytes go directly from the browser to private Supabase Storage. Next.js only issues single-object credentials and verifies the object and size after completion.", invalidSessionTitle: "Cannot bind this session", invalidSessionBody: "This session does not exist, does not belong to you, or is closed. Return to tasks and open an available session.", backToTasks: "Back to my tasks", recentUploads: "Recent uploads", noUploads: "No uploads yet.", unableDetermine: "Unable to determine", uploadList: "Uploads", transfer: "Transfer", objectReconciliation: "Object reconciliation", metadata: "Metadata", match: "Match", uploadAttempts: "Upload attempts", noError: "No error", lightweightMetadata: "Lightweight metadata", containerCodec: "Container / codec", metadataUnavailable: "Metadata unavailable", resolutionUnavailable: "Resolution unavailable", fpsUnavailable: "FPS unavailable", evidence: "Evidence", captureTime: "Capture time", reviewCount: "Reviews: {count}", noWarning: "No warning", invitationActivation: "Participant activation", acceptResearch: "Confirm research participation", invitationInvalid: "Invitation is invalid or expired", invitationBody: "After you accept, the invitation expires immediately and your private participant workspace opens.", invitationContactAdmin: "Ask an admin to generate a new invitation. To protect the account, the system does not reveal whether a token exists.", backToLogin: "Back to sign in", invitationAccountBody: "Your admin provides the sign-in account and system-generated password. Confirm to activate your participant workspace.", activating: "Activating…", acceptInvitation: "Accept invitation and open tasks",
    queue: { requestFailed: "Request failed.", invalidType: "{file} is not an MP4, MOV, or INSV file.", invalidSize: "{file} exceeds 50,000,000 bytes or is empty.", mimeMismatch: "The browser MIME for {file} does not match its extension.", boundElsewhere: "This file has a resumable upload bound to another session. Resume it from the general upload page or choose another file.", restoreMismatch: "The selected file does not match the original resumable upload. Choose it again.", hashFailed: "Could not calculate the complete file SHA-256.", batchLimit: "Choose at most {count} files per batch.", hashingPending: "The file fingerprint is not ready.", chooseSession: "Choose a recording session or Unable to determine for this file.", resourceExpired: "The TUS resource expired. Retrying will create a new upload attempt.", uploadFailed: "Upload failed: {message}", metadataFailed: "The video completed object reconciliation, but metadata processing failed: {message}", parseFailed: "Parsing failed", reconcileFailed: "Object reconciliation failed.", savedResourceMissing: "The saved TUS resource URL is missing from this browser. Create a new upload attempt and retry.", prepareFailed: "Upload preparation failed.", boundSessionAria: "Bound recording session", boundSession: "Session bound; it cannot be changed during upload", chooseFiles: "Choose video from a device or SSD", fileLimits: "MP4 / MOV / INSV · up to 5 per batch · 50,000,000 bytes per file", restorable: "Resumable uploads ({count})", restoreHelp: "Browser security requires you to choose the original file again. The TUS offset is restored only after the complete SHA-256 matches.", acceptedSaved: "Accepted {accepted} / {total} · saved {date}", mayBeExpired: "Resource may have expired", restoreProgress: "Resumable upload progress {progress}%", chooseOriginal: "Choose the original file to resume", legacyRestore: "There are {count} legacy resume records. Choose the original file above; it will be migrated and resumed after verification.", modifiedAt: "Modified {date}", recordingSession: "Recording session", lockedSessionAria: "Locked recording session", locked: "Locked", choose: "Choose…", note: "Note (optional)", notePlaceholder: "Do not enter sensitive information", uploadProgress: "Upload progress {progress}%", hashing: "Calculating complete file SHA-256…", resumed: "Resumed from the TUS offset saved in this browser", duplicate: "Possible duplicate: sent to human review only; it is not deleted or rejected automatically.", start: "Start direct storage upload", pause: "Pause", resume: "Resume", newAttemptRetry: "Create a new attempt and retry", resumeRetry: "Resume and retry", abort: "Cancel", serverStatus: "View server status" },
    metadataRanges: "{count}/24 ranges",
  },
  adminUi: {
    operationsCenter: "Collection operations", dashboard: "Collection dashboard", manageTasks: "Manage collection tasks", queue: "Attention queue", signalsToday: "Signals to handle today", missingUpload: "Missing upload", uploadFailed: "Upload failed", metadataFailed: "Metadata failed", unmatched: "Unmatched", deviceMismatch: "Device mismatch", awaitingReview: "Awaiting review", last24Hours: "Last 24 hours", assignmentProgress: "Participation progress", uploadProgress: "Upload progress", readonlyActivity: "Read-only activity log", recentAudit: "Recent audit", viewAll: "View all", noAudit: "No audit events yet.",
    taskCollaboration: "Collection progress and collaboration", tasksTitle: "Collection tasks", tasksBody: "Open a task to manage participants, recording progress, and uploaded video. A running task keeps at least one participant.", createTask: "Create task", taskFilterAria: "Filter collection tasks", taskSearchAria: "Search tasks", taskSearchPlaceholder: "Search task name or ID", taskLifecycle: "Task lifecycle", allTasks: "All tasks", published: "Published", filter: "Filter", taskListAria: "Task list", task: "Task", participants: "Participants", completed: "Completed", videos: "Videos", attention: "Attention", nextDue: "Next due", unpublished: "Not published", noMatchingTasks: "No collection tasks match. Clear the filters or create the first task.", taskList: "Task list", taskTemplate: "Task template", createRecordingTask: "Create recording task",
    taskBack: "Collection tasks", demoData: "Demo data", taskHistorySafe: "One task contains a group of participants. Each person keeps separate progress, recording sessions, and videos; roster changes never rewrite history.", taskSummary: "Task summary", taskDetails: "Task details", overview: "Overview", uploadedVideos: "Uploaded videos", instructions: "Instructions", activityLog: "Activity log", publishedVersions: "Published versions", frozen: "Frozen", firstVersionBindingHelp: "Maintain the publish roster under Participants. The first publish binds the roster to a frozen version and creates assignments.",
    taskOverview: "Task overview", currentParticipants: "Current participants", excludesStopped: "Excludes stopped participants", completedParticipants: "Completed participants", completionRate: "Completion rate {value}%", validVideos: "Valid videos", matchedToTask: "Matched to this task", needsHandling: "Needs handling", handleSoon: "Review soon", noAnomalies: "No current issues", overallProgress: "Overall progress", participantsCompleted: "{completed} / {total} completed", taskCompletionRate: "Task completion rate {value}%", duePrefix: "Due {date}", noPendingParticipants: "No participants are currently pending. The nearest due dates will appear here after participants are added.", recentActivity: "Recent activity", receivedVideo: "Video received: {filename}", uploadVerified: "Upload verified", uploadProcessing: "Upload in progress", systemActor: "System", noTaskActivity: "This task has no upload or activity records yet.",
    noTaskParticipants: "This task has no participants", addParticipantsHelp: "Use Add participants in the upper-right corner and choose one or more people to start collection.", draftRoster: "Draft roster", bindOnFirstPublish: "Bound on first publish", currentProgressCount: "{count} participants count toward current progress", sessions: "Sessions", historicalParticipants: "Past participants", draftRosterState: "Awaiting publish",
    uploadsSummary: "{count} uploads{attention}.", uploadsAttention: ", {count} need handling", uploadsNoAttention: ", with no current issues", openAttention: "Open attention queue", humanReview: "Human review", reviewItems: "{count} items to handle", noHandlingNeeded: "No action needed", sessionLabel: "Recording session: {value}", notDetermined: "Not determined", resolutionPending: "Resolution pending", deviceConsistency: "Device consistency: {value}", awaitingReconciliation: "Awaiting reconciliation", viewUploadDetails: "View upload details", handleAnomaly: "Handle issue", noUploadedVideos: "No uploaded videos", noUploadedVideosHelp: "Transfer, metadata, matching, and review states appear here after participants record and upload.",
    auditIntro: "Important task, participant, and video-matching changes are recorded here. History is read-only and roster changes never overwrite it.", recorded: "Recorded", operator: "Operator: {name}", object: "Object: {id}", changes: "Changes: {fields}", moreChanges: " and {count} more", reasonPrefix: "Reason: ", noActivity: "No activity records", noActivityHelp: "Records appear after participants are added or adjusted, versions are published, or videos are handled.",
    assignmentsKicker: "Frozen task delivery", assignments: "Assignments", createAssignment: "Create assignment", assignmentSearch: "Assignment / participant / task", allStatuses: "All statuses", taskVersion: "Task version", due: "Due", statusSignals: "Status / signals", missing: "Missing", noAssignments: "No assignments yet.", assignmentsBack: "Back to assignments", assignmentAuthorityHelp: "The server rechecks active status, consent, published version, and device ownership. Select choices do not grant authority.", publishedTaskVersion: "Published task version", preferredDevice: "Preferred device", noDevice: "No device", locale: "Locale", assignmentNote: "Note", creating: "Creating…", assignmentCreateFailed: "Could not create the assignment.", manage: "Manage", collapse: "Collapse", operationReasonMin: "Operation reason, at least 10 characters", reasonMinError: "The reason must contain at least 10 characters.", extendNeedsDue: "Choose a new due date to extend.", extend: "Extend", operationFailed: "The operation failed.",
    closeSession: "Close recording session", closeReason: "Closing reason, at least 10 characters", closeReasonError: "The closing reason must contain at least 10 characters.", closing: "Closing…", confirmClose: "Confirm close", closeSessionFailed: "Could not close the recording session.",
    reviewKicker: "Human authority queue", reviewCases: "Review cases", reviewIntro: "Automated evidence only flags anomalies. Immutable match decisions and human reasons determine business relationships.", allTypes: "All types", case: "Case", type: "Type", relatedObject: "Related object", unresolvedParticipant: "Unresolved participant", noDecision: "No decision", noMachineReason: "No machine reason", noReviewCases: "No review cases match the current filters.", reviewBack: "Back to review queue", matchHistory: "Match decision history", noMatchDecisions: "No match decisions yet.", viewUpload: "View upload details", transfer: "Transfer", metadata: "Metadata", assignment: "Assignment", participantClaim: "Participant claim", supersedes: "Supersedes {value}", current: "Current", historical: "Historical", unmatchedValue: "Unmatched",
    humanAction: "Human action", terminalReview: "This review case is complete; its history remains available.", reviewAction: "Action", confirmCurrentMatch: "Confirm current match", correctSessionDevice: "Correct session / device", rejectUpload: "Reject upload", requestRerecord: "Request re-recording", extendAssignment: "Extend assignment", suspendParticipant: "Suspend participant", resolveWithoutMatch: "Resolve without changing match", dismissCase: "Dismiss case", newDueAt: "New due date", changePreview: "Change preview", confirmBeforeSubmit: "Confirm before submitting · {subject}", before: "Before", after: "After", chooseNewTime: "Choose a new time", reasonHelp: "Explain the evidence and reason for the change (10–500 characters)", reasonLengthError: "The reason must contain 10–500 characters.", retryReasonLengthError: "The retry reason must contain 10–500 characters.", reviewDecisionFailed: "The review decision failed.", metadataRetryFailed: "The metadata retry failed.", submitImmutableDecision: "Submit immutable decision", retryMetadata: "Retry metadata",
    countryRegion: "Country / region", timezone: "Timezone", currentValue: "Current value", chooseSuggestion: "Choose a value from the {field} suggestions", searchField: "Search {field}", tablePagination: "Table pagination", totalRows: "{count} rows · Page {page} of {pages}", rowsPerPage: "Rows per page", rowsPerPageAria: "Rows per page", rows: "{count} rows", apply: "Apply", goToPage: "Go to page", goToPageRange: "Go to a page from 1 to {pages}", jump: "Go", previousPage: "Previous page", nextPage: "Next page",
    recordsKicker: "Cross-task collection operations", records: "Collection records", recordsIntro: "Review video uploads, recording sessions, and key activity in one place; issues still return to their authoritative details and attention queue.", recordsSummary: "Collection record summary", totalUploads: "All uploads", transfersInProgress: "Transfers in progress", openSessions: "Open sessions", needsAttention: "Needs attention", anomalyOverview: "Issue overview", duplicateCandidate: "Possible duplicates", totalReviews: "Total reviews", videoRecords: "Video records", sessionRecords: "Recording sessions", recordsView: "Collection record views",
    videoRecordsIntro: "Review transfer, metadata, matching, and human review state by upload. Missing uploads appear separately in the issue overview above.", searchVideoRecords: "Search video records", videoSearchPlaceholder: "Filename, participant, task, or recording session", transferStatus: "Transfer status", allTransferStatuses: "All transfer statuses", metadataStatus: "Metadata status", allMetadataStatuses: "All metadata statuses", handlingStatus: "Handling status", allRecords: "All records", attentionOnly: "Needs handling only", clearFilters: "Clear filters", file: "File", taskSession: "Task / recording session", recordStatusColumns: "Transfer / metadata / match / review", sizeTime: "Size / time", taskPending: "Task not determined", claimed: "Claimed: ", final: "Final: ", notClaimed: "Not claimed", awaitingConfirmation: "Awaiting confirmation", noVideoRecordsFiltered: "No video records match", noVideoRecordsFilteredHelp: "Change the filters or clear them to view all uploads.", noVideoRecordsHelp: "Video records appear here after participants record and upload.", viewTasks: "View collection tasks",
    sessionsIntro: "Open sessions are shown by default. All history and closed sessions remain searchable so videos arriving hours or days later can be traced.", searchSessions: "Search recording sessions", sessionSearchPlaceholder: "Recording session, participant, task, or assignment", sessionStatus: "Session status", notClosed: "Open", allHistory: "All history", taskDevice: "Task / device", markerVideos: "Marker / videos", createdTime: "Created", closedAt: "Closed {date}", markerConfirmed: "Marker confirmed", markerPending: "Marker pending", matchedVideos: "{count} matched videos", viewRelatedVideos: "View related videos", noSessionsFiltered: "No recording sessions match", noOpenSessions: "No open recording sessions", noSessionsFilteredHelp: "Change the filters or return to the default open-session list.", noOpenSessionsHelp: "View all history to trace closed sessions and late-arriving videos.",
    auditRecordsIntro: "Read-only audit evidence is presented as localized summaries; raw actions, request IDs, and change JSON can be expanded when needed.", searchActivity: "Search activity", activitySearchPlaceholder: "Object ID, raw action, or operator", actionCategory: "Action category", allActions: "All actions", actor: "Operator", reasonChanges: "Reason / change summary", time: "Time", noPublicId: "No public ID", noReason: "No reason provided", changedFields: "Changed: {fields}", noBeforeAfterChanges: "No before / after field changes", viewChanges: "View change details", rawAction: "Raw action: {value}", requestId: "Request ID: {value}", noBeforeAfterJson: "No before / after JSON.", noActivityFiltered: "No activity records match", noActivityFilteredHelp: "Change the filters or clear them to view all evidence.", noActivityImmutableHelp: "Key operations are automatically written to the immutable audit log.", categoryTask: "Collection tasks", categoryParticipant: "Participants and devices", categoryAssignment: "Assignments", categorySession: "Recording sessions", categoryUpload: "Video uploads", categoryMetadata: "Video metadata", categoryReview: "Matching and review", categorySystem: "System and other",
    uploadsBack: "Back to uploads", demoRetentionExpired: "Demo object retention expired", matchDevice: "Match / device", objectClaim: "Object and participant claim", uploadAttempts: "Upload attempts", normalizedMetadata: "Normalized metadata", metadataUnavailableIndependent: "Metadata is not available yet; transfer status remains independent.", fieldEvidence: "Field evidence", noAllowlistEvidence: "No allowlist field evidence yet.", relatedReviews: "Related review cases", noRelatedReviews: "No related review cases.", claimedSession: "Claimed recording session", localModified: "Local modified time", participantNote: "Participant note", failureCode: "Failure code", verifiedAt: "Verified at", intentExpires: "Upload intent expires", videoAsset: "Video asset", objectKey: "Object key", parser: "Parser", container: "Container", duration: "Duration", video: "Video", audio: "Audio", captureTime: "Capture time", camera: "Camera", serialHmac: "Serial HMAC", gpsPresent: "GPS metadata present", projection360: "Projection / 360", extracted: "Extracted", channels: "{count} channels", not360: "Not 360", expires: "Expires {date}", ranges: "Ranges {count}/24", fiveMinutePreview: "5-minute private preview", retryReason: "Retry reason (10–500 characters)", previewFailed: "Could not create the preview link.",
    participantsBack: "Back to participants", consent: "Consent", region: "Region", managementEmail: "Management email", defaultDevice: "Default device", participantProfile: "Participant profile", participantProfileHelp: "The management email is for internal records only; no real email is sent. Notes must not contain sensitive information.", displayAlias: "Display alias", sensitiveNotesHelp: "Up to 500 characters. Do not enter names, addresses, identity numbers, or other sensitive information.", saveParticipant: "Save participant profile", invitationAndStatus: "Invitation and status", invitationHashHelp: "The invitation link is displayed once; only its SHA-256 hash is stored.", currentInvitation: "Current invitation: {status}", notGenerated: "Not generated", fixtureProtected: "Protected; public admins cannot change it.", generateInvitation: "Generate / resend invitation", generating: "Generating…", oneTimeInvitationUrl: "One-time invitation URL", copyLink: "Copy link", openNewWindow: "Open in new window", operationReason: "Operation reason", minimum10: "At least 10 characters", revokeInvitation: "Revoke invitation", pauseParticipant: "Suspend", reactivateParticipant: "Reactivate", withdrawParticipant: "Withdraw from study", registerDevice: "Register device", manufacturer: "Manufacturer", model: "Model", deviceTypePhone: "Phone", deviceTypeActionCamera: "Action camera", deviceTypeCamera: "Camera", deviceTypeOther: "Other", serialHmacOnly: "Serial (HMAC only)", firmware: "Firmware", setDefaultDevice: "Set as default device", registering: "Registering…", updateReason: "Reason for change (10–500 characters)", noDevices: "No devices registered.", invitationCreateFailed: "Could not create the invitation.", invitationRevokeFailed: "Could not revoke the invitation.", statusChangeReasonError: "The status-change reason must contain at least 10 characters.", statusChangeFailed: "Could not change the status.", deviceCreateFailed: "Could not register the device.", participantUpdateFailed: "Could not update the participant.", deviceUpdateFailed: "Could not update the device.", createRegistryEntry: "Create registry entry", createParticipant: "Create participant", createParticipantHelp: "Create a draft first, then generate a one-time demo invitation. Real email is outside the MVP scope.", managementEmailNoSend: "Management email (no email sent)", newNotesHelp: "Up to 500 characters. Do not enter names, phone numbers, or other sensitive information.", creatingParticipant: "Creating…", createDraftParticipant: "Create draft participant", participantCreateFailed: "Could not create the participant.",
    participantList: { kicker: "Participant registry", filters: "Participant filters", allConsentStatuses: "All consent statuses", allLocales: "All locales", allCountriesRegions: "All countries / regions", allMissingSignals: "All missing states", onlyMissing: "Missing only", excludeMissing: "Exclude missing", allReviewSignals: "All review states", onlyNeedsReview: "Needs review only", excludeNeedsReview: "Exclude needs review" },
    participantDrawer: { viewAria: "View {id}", editAria: "Edit {id}", viewTitle: "View participant", editTitle: "Edit participant", viewSubtitle: "Profile and current sign-in credentials", editSubtitle: "Update profile", closeAria: "Close participant drawer", loadingProfile: "Loading participant profile…", reloadProfile: "Reload", profileLoadFailed: "Could not load the participant profile. Try again.", profileNetworkFailed: "Could not load the participant profile. Check your connection and try again.", basicProfile: "Profile", openFullDetails: "Open full details", fixture: "Demo fixture", loginInformation: "Participant sign-in information", loginInformationHelp: "Available to view and copy again; use only for the participant site.", credentialMissing: "Not generated", credentialPendingActivation: "Awaiting activation", credentialPendingSync: "Awaiting sync", credentialReady: "Synced", loginAddress: "Sign-in address", loginAccount: "Account", copyAccount: "Copy account", copyPassword: "Copy password", passwordUnavailable: "No retrievable password has been generated.", pendingActivationHelp: "The password is generated, but the participant must accept the invitation before signing in.", pendingSyncHelp: "The password has not finished syncing to authentication. Continue syncing before sharing it with the participant.", readyBlockedHelp: "The password is synced, but the participant's current status or consent does not allow sign-in.", readyCanLogin: "These credentials can sign in now.", fullLoginInformation: "Sign-in address: {url}\nAccount: {account}\nPassword: {password}", copyFullLoginInformation: "Copy full sign-in information", copied: "{label} copied.", copyFailed: "Copy failed. Select the text and copy it manually.", generatePassword: "Generate sign-in password", continueSync: "Continue sync", resetPassword: "Reset sign-in password", confirmGeneratePassword: "Generate a sign-in password for this participant?", confirmSyncPassword: "Continue syncing the current password to the participant account?", confirmResetPassword: "Reset the sign-in password? The old password will stop working immediately.", processing: "Processing…", credentialOperationFailed: "The password operation failed. Try again.", credentialNetworkFailed: "The password operation failed. Check your connection and try again.", credentialSynced: "Password synced.", credentialGenerated: "A new sign-in password was generated. The old password no longer works.", fixtureCredentialProtected: "This demo fixture is protected. Public admins cannot generate or reset its password.", fixtureEditProtected: "This demo fixture is protected. Public admins can view it but cannot save changes.", profileConflict: "Another operation updated this profile. The latest values have been loaded; review them before saving again.", profileUpdateFailed: "Could not update the participant. Try again.", profileUpdateNetworkFailed: "Could not update the participant. Check your connection and try again.", saveChanges: "Save changes" },
    removeItem: "Remove {label} {number}", enterCustomOption: "Enter a custom option", alreadyAdded: "“{value}” is already added", maxItems: "Add at most {count} items", selectedLabel: "Selected {label}", removeValue: "Remove “{value}” from {label}", nothingAdded: "Nothing added yet.", addFromPreset: "Add from presets", choosePreset: "Choose a preset", addCustomOption: "Add a custom option", addCustom: "Add custom {label}", add: "Add",
    removeModule: "Remove {title} module", taskDraftSaveFailed: "Could not save the task draft. Check the content and try again.", taskDraftSaved: "Task draft saved.", serverConnectionFailed: "Could not reach the server. Check your connection and try again.", taskPublishFailed: "Could not publish the task version. Try again later.", versionPublished: "Version {version} published.", basicInformation: "Basic information", basicInformationHelp: "Participants first see the title, description, and target recording specification. Fields marked * are required.", taskTitle: "Task title *", taskTitleExample: "Example: Make a cup of coffee", taskDescription: "Task description *", taskDescriptionHelp: "Explain what the participant should do and the expected outcome.", recordingSpec: "Recording specification", recordingSpecHelp: "These values appear in participant instructions and define targets for post-upload metadata checks.", targetDurationMinutes: "Target recording duration (minutes) *", durationToleranceMinutes: "Allowed duration variance (± minutes) *", targetResolution: "Target resolution *", customResolution: "Custom resolution…", customResolutionLabel: "Custom resolution", resolutionExample: "Example: 1440p", targetFps: "Target frame rate (FPS) *", customFps: "Custom frame rate…", customFpsLabel: "Custom frame rate", taskModulesHelp: "Add instruction modules as needed. The participant app shows non-empty modules in a fixed order.", addInstructionModule: "Add instruction module",
    moduleEnvironment: "Environment and activity area", moduleSteps: "Detailed steps", moduleObjects: "Required objects", moduleMustShow: "Must show", moduleMustAvoid: "Must avoid", moduleConstraints: "Other recording constraints", moduleCompletion: "Completion criteria", moduleUpload: "Upload instructions", modulePrivacy: "Privacy checklist", environmentModuleHelp: "Describe preparation before recording and where the activity may take place.", environmentExample: "Example: Keep the kitchen counter well lit", addEnvironment: "Add environment preparation", areaLimit: "Activity-area limit", areaExample: "Example: Keep the activity inside the kitchen", addAreaLimit: "Add area limit", stepsHelp: "Step order is shown directly to participants; expected visuals explain the evidence each step should leave.", stepNumber: "Step {number}", moveStepUp: "Move step {number} up", moveStepDown: "Move step {number} down", deleteStep: "Delete step {number}", operationInstruction: "Instruction *", operationInstructionHelp: "Describe what the participant should do in this step", expectedVisualEvidence: "Expected visual evidence", cupExample: "Example: Coffee cup", addStep: "Add step", objectsHelp: "List the objects required to complete the task and whether each must appear in frame.", objectName: "Object name *", coffeeMakerExample: "Example: Coffee maker", mustBeVisible: "Must be visible", deleteObject: "Delete required object {number}", addObject: "Add object", mustShowHelp: "Select content that must remain or clearly appear in frame.", processExample: "Example: Coffee-making process", mustAvoidHelp: "Select private information, reflections, or unrelated content that cannot appear.", billExample: "Example: Household bill", constraintsHelp: "Add execution limits that do not fit under must show or must avoid.", recordingConstraint: "Recording constraint", constraintExample: "Example: Keep your head facing the work area", addConstraint: "Add recording constraint", completionHelp: "Metadata checks file and technical specifications; researchers still review content completion manually.", criterionDescription: "Criterion *", criterionExample: "Example: The coffee has finished brewing", validationMethod: "Validation method", manualReviewLabel: "Human review", metadataCheckLabel: "Metadata check", deleteCriterion: "Delete completion criterion {number}", addCriterion: "Add criterion", uploadModuleHelp: "Explain where videos may be stored, how to upload them, and how to recover after a network interruption.", allowedFileSources: "Allowed file sources *", cameraStorage: "Camera internal storage", uploadOperationInstructions: "Upload instructions", uploadOriginalExample: "Example: Choose the original file produced by the camera", addUploadInstruction: "Add upload instruction", recoveryInstructions: "Recovery instructions", recoveryExample: "Example: Choose the same file again and resume", addRecoveryInstruction: "Add recovery instruction", privacyHelp: "Privacy requirements participants must confirm before uploading.", checklistItem: "Checklist item", privacyExample: "Example: No private photos appear in frame", addPrivacyItem: "Add privacy item", noInstructionModules: "No instruction modules yet", noInstructionModulesHelp: "Use Add instruction module to include environment, steps, visual requirements, and upload guidance.", systemRecordingRules: "System recording and matching rules", firstPersonRule: "Record first-person video with a head-mounted device.", authorityRule: "Participant, task version, and device are derived from the assignment and recording session, never from the filename.", creatingDraft: "Creating draft…", savingDraft: "Saving draft…", createDraft: "Create draft", saveDraft: "Save draft", publishingVersion: "Publishing version…", saveDraftFirst: "Save draft first", publishNewVersion: "Publish new version",
    presetHands: "Participant's hands", presetProcess: "Complete operation", presetTools: "Tools in use", presetInitialEnvironment: "Environment before task", presetResult: "Completed result", presetFace: "Faces", presetMirror: "Mirrors", presetId: "Identity documents", presetAddress: "Addresses", presetNotifications: "Screen notifications", presetPhotos: "Private photos", presetLocation: "Location information", presetObject: "Object being handled", presetInitialState: "Initial task state",
    validationInvalid: "Check this field and try again.", validationTolerance: "The allowed variance must be shorter than the target recording duration", validationStepOrder: "Recording steps must be consecutively ordered starting at 1", validationCodeUnique: "Codes must be unique", validationOverlap: "The same content cannot be both required and forbidden",
    chooseDueError: "Choose a new due date.", chooseReplacementError: "Choose a replacement participant.", replace: "Replace", stop: "Stop", replaceParticipant: "Replace participant", stopParticipation: "Stop participation", adjustDue: "Adjust due date", closePeopleManager: "Close participant-management dialog", participantStats: "Version {version} · {sessions} sessions · {videos} videos", replaceHistoryHelp: "Replacement stops only the original participant's future actions. Existing recording sessions, uploads, and videos remain with the original participant and are not transferred.", replacementParticipant: "Replacement participant", chooseAvailableParticipant: "Choose an available participant", sameAsOriginal: "Same as original record", newDue: "New due date", noDeviceSpecified: "No device specified", cancelHistoryHelp: "Stopping closes open recording sessions and prevents new sessions and uploads. The last participant cannot be stopped alone; use replacement instead.", reasonPlaceholder: "Explain the change, at least 10 characters", processing: "Processing…", stopAndAssign: "Stop {name} and assign", saveNewDue: "Save new due date", removeFromRoster: "Remove from publish roster", closeRemoveParticipant: "Close remove-participant dialog", removeRosterHelp: "This task has not been published, so it has no assignment, recording session, or upload records. The participant can be added again or replaced later.", removing: "Removing…", confirmRemove: "Confirm removal", remove: "Remove", rosterRemoveFailed: "Could not remove the participant from the publish roster. Try again.",
    regionFilterAll: "Filter region; all regions selected", regionFilterSelected: "Filter region; {count} regions selected", regionLabel: "Region", allRegions: "All regions", selectedCount: "{count} selected", regionOptions: "Region options", noRegions: "No region data", clearRegionFilter: "Clear region filter", alreadyInRoster: "Already in publish roster", alreadyInTask: "Already in this task", participantInactive: "Participant is not active", consentInvalid: "Consent is not valid", eligible: "Eligible", chooseParticipantError: "Choose at least one participant.", addParticipantFailed: "Could not add participants. Check your connection and try again.", addParticipants: "Add participants", addParticipantsIntro: "Choose one or more people at once. Each receives an independent task record.", closeAddParticipants: "Close add-participants dialog", addParticipantsSteps: "Add-participant steps", choosePeople: "Choose people", choosePeopleComplete: "Choose people, complete", devicesAndSettings: "Devices and settings", joinedRoster: "Added to publish roster · {count} people", participantsAdded: "Added {count} participants", participantsSkipped: "{count} participants not added", shownSelected: "Showing {shown}; {selected} selected", searchParticipants: "Search participants", participantSearchPlaceholder: "Search name, ID, or region", chooseName: "Choose {name}", noParticipantMatches: "No participants match. Change the search.", devicesSettingsHelp: "Confirm devices for the {count} selected participants and complete the shared settings.", sharedSettings: "Shared settings", sharedSettingsHelp: "These settings apply to everyone selected.", latest: "Latest", draftRosterHelp: "This task is still a draft. Participants join the publish roster first; the first publish binds them to the frozen version and creates formal assignments.", assignmentNotes: "Assignment note", visibleOptional: "Optional; visible to participants", perPersonDevice: "Device per participant", deviceOptionalHelp: "Devices are optional. Default devices are preselected when available.", selectedPeople: "{count} people selected", done: "Done", nextSettings: "Next: devices and settings", previousStep: "Previous step", joining: "Adding…", assigning: "Assigning…", joinRoster: "Add to publish roster", assignCount: "Assign to {count} people",
  },
  labels: {
    taskOperational: { draft: "Draft", awaiting_participants: "Awaiting participants", running: "Running", needs_attention: "Needs attention", completed: "Completed", archived: "Archived" },
    matchDecision: { participant_claim: "Participant claim", admin_confirmed: "Admin confirmed", admin_corrected: "Admin corrected", unmatched: "Unmatched", rejected: "Match rejected", pending: "Awaiting match" },
    deviceConsistency: { matched: "Matched", partial_match: "Partial match", metadata_unavailable: "Metadata unavailable", model_mismatch: "Model mismatch", serial_mismatch: "Serial mismatch", metadata_conflict: "Metadata conflict" },
    captureTimeSource: { quicktime_with_timezone: "QuickTime with timezone", container: "Container", track: "Video track", local_modified: "Local modification time", unknown: "Unknown" },
    recordHealth: { attention: "Needs attention", ready: "Ready", progress: "In progress" },
    reviewCaseType: { missing: "Missing upload", upload_failed: "Upload failed", metadata_failed: "Metadata failed", duplicate_candidate: "Possible duplicate", unmatched: "Unmatched", device_mismatch: "Device mismatch", needs_review: "Needs review" },
    auditAction: Object.fromEntries(Object.keys(zhCN.labels.auditAction).map((key) => [key, key.replaceAll("_", " ").replaceAll(".", " · ")])) as unknown as I18nCatalog["labels"]["auditAction"],
    entity: { assignment: "Assignment", device: "Collection device", metadata: "Video metadata", participant: "Participant", recording_session: "Recording session", review_case: "Review case", task: "Collection task", upload_attempt: "Upload attempt", upload_batch: "Upload batch", upload_intent: "Video upload", video_asset: "Video asset" },
    field: { participantPublicId: "Participant", replacementParticipantPublicId: "Replacement participant", taskPublicId: "Collection task", taskVersion: "Task version", dueAt: "Due date", status: "Status", preferredDevicePublicId: "Preferred device", sessionPublicId: "Recording session", devicePublicId: "Device" },
  },
  state: {
    "participant.status": { draft: "Draft", invited: "Invited", expired: "Expired", active: "Active", suspended: "Suspended", withdrawn: "Withdrawn" },
    "participant.consent_status": { pending: "Pending", valid: "Valid", expired: "Expired", withdrawn: "Withdrawn" },
    "participant_invitation.status": { generated: "Generated", opened: "Opened", accepted: "Accepted", revoked: "Revoked", expired: "Expired" },
    "consent_record.status": { accepted: "Accepted", withdrawn: "Withdrawn", expired: "Expired" },
    "device.status": { active: "Active", lost: "Lost", retired: "Retired", shared: "Shared" },
    "task.lifecycle": { draft: "Draft", active: "Active", archived: "Archived" },
    "assignment.status": { assigned: "Assigned", acknowledged: "Acknowledged", session_created: "Session created", uploading: "Uploading", submitted: "Submitted", needs_review: "Needs review", rework_required: "Rework required", accepted: "Accepted", expired: "Expired", missing_upload: "Missing upload", canceled: "Canceled" },
    "recording_session.status": { open: "Open", closed: "Closed" },
    "upload_batch.status": { open: "Open", completed: "Completed", aborted: "Aborted", expired: "Expired" },
    "upload_intent.transfer_status": { created: "Created", uploading: "Uploading", reconciling: "Reconciling", verified: "Verified", failed: "Failed", aborted: "Aborted", expired: "Expired" },
    "upload_intent.metadata_status": { pending: "Pending", processing: "Processing", extracted: "Extracted", partial: "Partial", unsupported: "Unsupported", failed: "Failed" },
    "upload_attempt.status": { created: "Created", uploading: "Uploading", paused: "Paused", completed: "Completed", failed: "Failed", aborted: "Aborted", expired: "Expired" },
    "video_asset.status": { active: "Active", rejected: "Rejected", deleted: "Deleted" },
    "metadata_attempt.status": { processing: "Processing", extracted: "Extracted", partial: "Partial", unsupported: "Unsupported", failed: "Failed" },
    "review_case.status": { open: "Open", in_review: "In review", resolved: "Resolved", dismissed: "Dismissed" },
  },
  stateAction: {
    "participant.status": { invite: "Send invitation", expireInvitation: "Expire invitation", acceptInvitation: "Accept invitation", suspend: "Suspend", resume: "Resume", withdraw: "Withdraw" },
    "participant.consent_status": { accept: "Accept consent", expire: "Expire", withdraw: "Withdraw consent" },
    "participant_invitation.status": { open: "Open", accept: "Accept", revoke: "Revoke", expire: "Expire" },
    "consent_record.status": {},
    "device.status": { markLost: "Mark lost", share: "Share", activate: "Activate", retire: "Retire" },
    "task.lifecycle": { publish: "Publish", archive: "Archive" },
    "assignment.status": { acknowledge: "Acknowledge", createSession: "Create session", startUpload: "Start upload", submit: "Submit", requireReview: "Require review", requestRework: "Request rework", accept: "Accept", expire: "Expire", markMissing: "Mark missing", extendUnacknowledged: "Extend", extendAcknowledged: "Extend", cancel: "Cancel" },
    "recording_session.status": { close: "Close" },
    "upload_batch.status": { complete: "Complete", abort: "Abort", expire: "Expire" },
    "upload_intent.transfer_status": { start: "Start", reconcile: "Reconcile", verify: "Verify", fail: "Mark failed", abort: "Abort", expire: "Expire" },
    "upload_intent.metadata_status": { start: "Start processing", extract: "Finish extraction", partial: "Mark partial", markUnsupported: "Mark unsupported", fail: "Mark failed", retry: "Retry" },
    "upload_attempt.status": { start: "Start", pause: "Pause", complete: "Complete", fail: "Mark failed", abort: "Abort", expire: "Expire" },
    "video_asset.status": { reject: "Reject", delete: "Delete" },
    "metadata_attempt.status": { extract: "Finish extraction", partial: "Mark partial", markUnsupported: "Mark unsupported", fail: "Mark failed" },
    "review_case.status": { beginReview: "Begin review", resolve: "Resolve", dismiss: "Dismiss" },
  },
  errors: Object.fromEntries(Object.keys(zhCN.errors).map((code) => [code, code === "UNKNOWN" ? "The operation failed. Try again later." : code.toLowerCase().replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()) + "." ])) as unknown as I18nCatalog["errors"],
} satisfies I18nCatalog;

const ja = {
  ...zhCN,
  meta: { adminTitle: "EgoCapture — 研究運用コンソール", adminDescription: "参加者、収集タスク、録画セッション、アップロード、レビューを管理します。", participantTitle: "EgoCapture — 参加者ポータル", participantDescription: "一人称動画のタスクを確認し、録画セッションを作成して安全にアップロードします。" },
  language: { label: "言語", zhCN: "简体中文", en: "English", ja: "日本語", changing: "言語を切り替えています…", changeFailed: "言語を変更できませんでした。もう一度お試しください。" },
  common: { ...zhCN.common, admin: "管理者", participant: "参加者", loading: "読み込み中…", saving: "保存中…", submitting: "送信中…", cancel: "キャンセル", close: "閉じる", confirm: "確認", continue: "続行", save: "保存", edit: "編集", delete: "削除", retry: "再試行", refresh: "更新", back: "戻る", next: "次へ", previous: "前へ", view: "表示", details: "詳細", status: "状態", actions: "操作", createdAt: "作成日時", updatedAt: "更新日時", dueAt: "期限", expiresAt: "有効期限", name: "名前", email: "メール", notes: "メモ", device: "機器", reason: "理由", optional: "任意", default: "既定", none: "なし", unknown: "不明", notAvailable: "利用不可", yes: "はい", no: "いいえ", files: { one: "{count} ファイル", other: "{count} ファイル" }, bytes: "{value} バイト", version: "バージョン {value}", pageOf: "{pages} ページ中 {page} ページ", empty: "データはまだありません。" },
  nav: { adminPrimary: "管理メインナビゲーション", allFeatures: "すべての管理機能", overview: "概要", tasks: "収集タスク", participants: "参加者", review: "レビュー待ち", records: "収集記録", systemGuide: "システムガイド", videoOperations: "動画収集運用", participantNav: "参加者ナビゲーション", myTasks: "タスク", uploads: "アップロード", logout: "ログアウト", loggingOut: "ログアウト中…" },
  auth: { adminAccount: "管理者アカウント", participantId: "参加者 ID", password: "パスワード", passwordHint: "10 文字以上", verifying: "確認中…", enterAdmin: "管理コンソールを開く", enterParticipant: "自分のタスクを開く", loginFailed: "ログインに失敗しました。しばらくしてからもう一度お試しください。", networkFailed: "サービスに接続できません。ネットワークを確認して再試行してください。", adminHeading: "研究運用コンソール", adminIntro: "参加者、タスク、録画セッション、アップロード、レビューを管理します。", participantHeading: "参加者ポータル", participantIntro: "タスクを確認し、録画セッションを作成して一人称動画を安全にアップロードします。", adminAccess: "管理者アクセス", adminHeadline: "すべての収集を追跡可能な研究証拠へ。", adminAudit: "参加者、タスク、アップロード、レビューを一つの監査記録に", authorizedOnly: "許可された研究運用担当者のみ利用できます。", separated: "管理コンソールと参加者ポータルは完全に分離されています。", fieldOperation: "現場収集", participantQuote: "一度の記録を丁寧に行い、実際の過程を見える形に。", privateStorage: "非公開オブジェクトストレージ", appendAudit: "追記専用監査", demoSynthetic: "このデモでは合成 ID と機密情報を含まない動画のみ使用してください。", participantAccess: "参加者アクセス", participantContinue: "収集タスクを続ける", participantLoginHelp: "招待に記載された PT で始まる参加者 ID でログインしてください。管理コンソールは別ドメインです。" },
  shell: { errorTitle: "問題が発生しました", errorBody: "現在このページを表示できません。もう一度お試しください。", notFoundTitle: "ページが見つかりません", notFoundBody: "ページが移動したか、アクセス権がない可能性があります。", backHome: "ホームに戻る", safeFailure: "安全な失敗", adminErrorTitle: "コンソールを読み込めませんでした", adminErrorBody: "業務データは変更されていません。しばらくしてから再試行してください。", participantErrorTitle: "ページを読み込めませんでした", participantErrorBody: "業務データは変更されていません。再試行し、問題が続く場合は前のページに戻ってください。", reload: "再読み込み", adminNotFoundTitle: "この管理ルートは存在しません", participantNotFoundTitle: "この収集ルートは存在しません", participantNotFoundBody: "リンクの有効期限が切れたか、このアカウントにアクセス権がない可能性があります。", loadingAdmin: "管理ページを読み込み中", loadingParticipant: "参加者ページを読み込み中" },
  participantUi: {
    queue: { requestFailed: "リクエストに失敗しました。", invalidType: "{file} は MP4、MOV、INSV ファイルではありません。", invalidSize: "{file} は 50,000,000 バイトを超えているか空です。", mimeMismatch: "{file} のブラウザ MIME と拡張子が一致しません。", boundElsewhere: "このファイルには別セッションに関連付けられた再開可能なアップロードがあります。通常のアップロードページから再開するか、別ファイルを選択してください。", restoreMismatch: "選択したファイルが再開対象の元ファイルと一致しません。選び直してください。", hashFailed: "完全なファイル SHA-256 を計算できませんでした。", batchLimit: "1 バッチにつき最大 {count} ファイルまで選択できます。", hashingPending: "ファイル指紋の処理が完了していません。", chooseSession: "このファイルの録画セッションまたは「判定不能」を選択してください。", resourceExpired: "TUS リソースの期限が切れました。再試行すると新しいアップロード試行を作成します。", uploadFailed: "アップロード失敗：{message}", metadataFailed: "動画はオブジェクト照合を完了しましたが、メタデータ処理に失敗しました：{message}", parseFailed: "解析に失敗しました", reconcileFailed: "オブジェクト照合に失敗しました。", savedResourceMissing: "ブラウザに保存された TUS リソース URL が見つかりません。新しいアップロード試行を作成して再試行してください。", prepareFailed: "アップロードの準備に失敗しました。", boundSessionAria: "関連付け済み録画セッション", boundSession: "セッションを関連付け済み。アップロード中は変更できません", chooseFiles: "機器または SSD から動画を選択", fileLimits: "MP4 / MOV / INSV · 1 バッチ最大 5 件 · 1 ファイル最大 50,000,000 バイト", restorable: "再開可能なアップロード（{count}）", restoreHelp: "ブラウザのセキュリティ制限により元ファイルを再選択してください。完全な SHA-256 が一致した場合のみ TUS offset を復元します。", acceptedSaved: "受領済み {accepted} / {total} · 保存日時 {date}", mayBeExpired: "リソース期限切れの可能性", restoreProgress: "再開可能アップロードの進捗 {progress}%", chooseOriginal: "再開する元ファイルを選択", legacyRestore: "旧形式の再開記録が {count} 件あります。上で元ファイルを選ぶと、検証後に移行して再開します。", modifiedAt: "更新日時 {date}", recordingSession: "録画セッション", lockedSessionAria: "固定された録画セッション", locked: "固定済み", choose: "選択…", note: "メモ（任意）", notePlaceholder: "機密情報を入力しないでください", uploadProgress: "アップロード進捗 {progress}%", hashing: "完全なファイル SHA-256 を計算中…", resumed: "ブラウザに保存された TUS offset から再開しました", duplicate: "重複の可能性：人による確認に送られ、自動削除や却下はされません。", start: "ストレージへ直接送信", pause: "一時停止", resume: "再開", newAttemptRetry: "新しい試行を作成して再試行", resumeRetry: "再開して再試行", abort: "キャンセル", serverStatus: "サーバー状態を表示" },
    metadataRanges: "範囲 {count}/24",
    homePlatform: "一人称動画収集プラットフォーム", loginWorkbench: "ワークスペースにログイン", heroLine1: "現場を動画に。", heroLine2: "すべての素材に明確な来歴を。", heroBody: "参加者は公開済みタスクに沿って録画・アップロードを行い、研究チームはタスク版、録画セッション、進捗、レビュー結果をいつでも確認できます。", viewWorkflow: "3 ステップを見る", demoWarning: "デモでは実在する ID や機密動画を使用しないでください。実際の収集前に同意とデータガバナンスを完了してください。", proofKicker: "保存だけでなく追跡可能", proofHeading: "すべての動画の出所と処理状態を確認できます。", proofVersion: "固定タスク版", proofVersionBody: "開始後は下書き変更の影響を受けません", proofMarker: "署名済みセッションマーカー", proofMarkerBody: "収集対象のセッションを記録します", proofResume: "再開可能なアップロード", proofResumeBody: "中断後も続きから再開できます", proofDirect: "非公開ストレージへ直接送信", proofDirectBody: "動画はアプリサーバーを経由しません", workflowKicker: "3 ステップで収集", workflowHeading: "参加者は手順に沿って収集し、研究チームは進捗を確認します。", workflowBody: "画面の案内に従うだけで、タスク版、セッション、アップロード状態、レビュー結果が保存されます。", workflow1Title: "今回の収集タスクを確認", workflow1Body: "開始前に公開済みの説明を確認します。後の下書き変更は割り当て済みの内容に影響しません。", workflow2Title: "録画セッションを作成", workflow2Body: "録画前にセッションを作成し、個人情報を含まない署名マーカーを生成します。", workflow3Title: "セッションを選んでアップロード", workflow3Body: "対応するセッションを選んで動画を送信します。中断・再開に対応し、異常や重複の疑いがある動画は自動削除せず人が確認します。", footerHeading: "ログインして収集またはタスク管理を開始。", footerBody: "参加者は招待の参加者 ID、管理者は勤務先メールでログインします。", previewReady: "準備完了", previewAria: "セッション状態プレビュー", previewDemo: "デモセッション", previewActivity: "日常活動の収集", previewMarker: "セッションマーカー", previewMarkerReady: "署名済み、録画を開始できます", previewNoIdentity: "個人を特定する情報は含みません", previewTaskVersion: "タスク版", previewFrozen: "固定済み", previewSessionMarker: "セッションマーカー", previewGenerated: "生成済み", previewUploadStatus: "アップロード状態", previewAwaitRecording: "録画待ち", tasksKicker: "参加者フィールドアプリ", greeting: "こんにちは、{name}", tasksImmutable: "各タスクは公開時の版に固定されます。後の下書き変更は受け取った説明に影響しません。", uploadRecordedFiles: "録画ファイルをアップロード", noAssignments: "現在割り当てられているタスクはありません。", myTasks: "自分のタスク", targetDuration: "目標時間：{duration}（許容 ±{tolerance}）", environmentAndArea: "環境と活動範囲", environmentSetup: "環境準備", areaConstraints: "活動範囲", requiredObjects: "必要な物", mustBeVisible: "映像に含める", needNotBeVisible: "意図的に映す必要なし", recordingSteps: "録画手順", expectedEvidence: "期待する証拠：{evidence}", defaultRecordingInstruction: "タスクの説明に従って活動を行い、連続して録画してください。", mustShow: "必ず映す", mustAvoid: "必ず避ける", otherRecordingConstraints: "その他の録画条件", targetSpec: "目標仕様：", firstPersonView: "頭部装着の一人称視点", sessionMarker: "セッションマーカー：", markerRequired: "少なくとも {seconds} 秒表示", markerOptional: "任意", uploadAndRecovery: "アップロードと再開", allowedSources: "許可された送信元：", uploadInstructions: "アップロード手順", recoveryInstructions: "中断後の再開", fileTaskMatching: "ファイルとタスクの照合", completionCriteria: "完了条件", manualReview: "人による確認", metadataCheck: "アップロード後にメタデータ確認", privacyCheck: "プライバシー確認", acknowledgedVersion: "確認済み版：{value}", showQrCode: "QR コードを表示", markerAcknowledged: "確認済み", markerPending: "未確認", uploadVideo: "動画をアップロード", sourceCamera: "カメラ / アクションカメラ", sourceSsd: "外付け SSD", sourceMobile: "スマートフォン", sourceDesktop: "パソコン", sourceOther: "その他の外部ストレージ", createSession: "録画セッションを作成", createSessionBody: "今回の録画に実際に使用する機器を選択します。参加者とタスク版は割り当てからサーバーが判断します。", contactAdminDevice: "先に管理者へ機器登録を依頼してください。", sessionCreateFailed: "録画セッションを作成できませんでした。", defaultDevice: "デフォルト", creating: "作成中…", createSessionAndMarker: "セッションを作成してマーカーを表示", acknowledging: "確認中…", acknowledgeVersion: "この版を読み、確認しました", acknowledgementFailed: "タスクを確認できませんでした。", uploadFiles: "ファイルをアップロード", signedMarker: "署名済みセッションマーカー", validUntil: "有効期限：{date}", markerQrAlt: "録画セッション {session} の署名済み QR コード", shortCode: "短縮コード", markerPrivacy: "QR コードにはセッション、割り当て、機器公開 ID、時刻、nonce、Ed25519 署名のみが含まれ、氏名やメールは含まれません。", downloadQr: "QR コードをダウンロード", generating: "生成中…", regenerateMarker: "マーカーを再生成", markerConfirming: "確認中…", markerCaptured: "QR コードを撮影しました", markerConfirmedAt: "確認済み：{date}", sessionClosed: "セッション終了", markerActionFailed: "マーカー操作に失敗しました。", directUpload: "TUS 直接アップロード", uploadPageBody: "動画データはブラウザから非公開 Supabase Storage へ直接送信されます。Next.js は単一オブジェクト用の資格情報を発行し、完了後にオブジェクトとサイズを検証します。", invalidSessionTitle: "このセッションを関連付けできません", invalidSessionBody: "セッションが存在しない、あなたのものではない、または終了しています。タスクへ戻り、利用可能なセッションから開いてください。", backToTasks: "自分のタスクに戻る", recentUploads: "最近のアップロード", noUploads: "アップロードはまだありません。", unableDetermine: "判定不能", uploadList: "アップロード一覧", transfer: "転送", objectReconciliation: "オブジェクト照合", metadata: "メタデータ", match: "照合", uploadAttempts: "アップロード試行", noError: "エラーなし", lightweightMetadata: "軽量メタデータ", containerCodec: "コンテナ / コーデック", metadataUnavailable: "メタデータ利用不可", resolutionUnavailable: "解像度利用不可", fpsUnavailable: "FPS 利用不可", evidence: "証拠", captureTime: "撮影時刻", reviewCount: "レビュー {count} 件", noWarning: "警告なし", invitationActivation: "参加者の有効化", acceptResearch: "研究参加を確認", invitationInvalid: "招待が無効または期限切れです", invitationBody: "同意すると招待は直ちに失効し、あなた専用の参加者ワークスペースが開きます。", invitationContactAdmin: "管理者に招待の再発行を依頼してください。アカウント保護のため、トークンの存在は表示されません。", backToLogin: "ログインに戻る", invitationAccountBody: "ログインアカウントとシステム生成パスワードは管理者から提供されます。確認すると参加者ワークスペースが有効になります。", activating: "有効化中…", acceptInvitation: "招待を承諾してタスクを開く",
  },
  adminUi: {
    operationsCenter: "収集運用センター", dashboard: "収集ダッシュボード", manageTasks: "収集タスクを管理", queue: "対応待ちキュー", signalsToday: "今日対応するシグナル", missingUpload: "アップロード不足", uploadFailed: "アップロード失敗", metadataFailed: "メタデータ失敗", unmatched: "未照合", deviceMismatch: "機器不一致", awaitingReview: "レビュー待ち", last24Hours: "過去 24 時間", assignmentProgress: "参加進捗", uploadProgress: "アップロード進捗", readonlyActivity: "読み取り専用操作記録", recentAudit: "最近の監査", viewAll: "すべて表示", noAudit: "監査イベントはまだありません。",
    taskCollaboration: "収集進捗とメンバー連携", tasksTitle: "収集タスク", tasksBody: "タスクから参加者、録画進捗、アップロード動画を管理します。進行中のタスクには少なくとも 1 人の参加者が必要です。", createTask: "タスク作成", taskFilterAria: "収集タスクを絞り込む", taskSearchAria: "タスクを検索", taskSearchPlaceholder: "タスク名または ID を検索", taskLifecycle: "タスクのライフサイクル", allTasks: "すべてのタスク", published: "公開済み", filter: "絞り込み", taskListAria: "タスク一覧", task: "タスク", participants: "参加者", completed: "完了", videos: "動画", attention: "要対応", nextDue: "次の期限", unpublished: "未公開", noMatchingTasks: "条件に一致する収集タスクはありません。絞り込みを解除するか、最初のタスクを作成してください。", taskList: "タスク一覧", taskTemplate: "タスクテンプレート", createRecordingTask: "録画タスクを作成",
    taskBack: "収集タスク", demoData: "デモデータ", taskHistorySafe: "1 つのタスクに複数の参加者を関連付けます。進捗、録画セッション、動画は個別に保持され、メンバー変更で履歴が書き換わることはありません。", taskSummary: "タスク概要", taskDetails: "タスク詳細", overview: "概要", uploadedVideos: "アップロード動画", instructions: "タスク説明", activityLog: "操作記録", publishedVersions: "公開済みバージョン", frozen: "固定済み", firstVersionBindingHelp: "「参加者」で公開対象を管理できます。初回公開時に対象者を固定バージョンへ関連付け、割り当てを作成します。",
    taskOverview: "タスク概要", currentParticipants: "現在の参加者", excludesStopped: "停止済みを除く", completedParticipants: "完了した参加者", completionRate: "完了率 {value}%", validVideos: "有効な動画", matchedToTask: "このタスクに照合済み", needsHandling: "対応が必要", handleSoon: "早めに確認してください", noAnomalies: "現在問題はありません", overallProgress: "全体進捗", participantsCompleted: "{completed} / {total} 人完了", taskCompletionRate: "タスク完了率 {value}%", duePrefix: "期限 {date}", noPendingParticipants: "未完了の参加者はいません。参加者を追加すると、直近の期限がここに表示されます。", recentActivity: "最近の動き", receivedVideo: "動画を受領：{filename}", uploadVerified: "アップロード確認済み", uploadProcessing: "アップロード処理中", systemActor: "システム", noTaskActivity: "このタスクにはアップロードや操作記録がまだありません。",
    noTaskParticipants: "このタスクには参加者がいません", addParticipantsHelp: "右上の「参加者を追加」から 1 人以上を選び、収集を開始してください。", draftRoster: "下書き名簿", bindOnFirstPublish: "初回公開時に関連付け", currentProgressCount: "{count} 人が現在の進捗に含まれます", sessions: "セッション", historicalParticipants: "過去の参加者", draftRosterState: "公開待ち",
    uploadsSummary: "アップロード {count} 件{attention}。", uploadsAttention: "、うち {count} 件は対応が必要です", uploadsNoAttention: "、現在問題はありません", openAttention: "対応待ちを開く", humanReview: "人によるレビュー", reviewItems: "要対応 {count} 件", noHandlingNeeded: "対応不要", sessionLabel: "録画セッション：{value}", notDetermined: "未確定", resolutionPending: "解像度の解析待ち", deviceConsistency: "機器整合性：{value}", awaitingReconciliation: "照合待ち", viewUploadDetails: "アップロード詳細を見る", handleAnomaly: "問題を処理", noUploadedVideos: "アップロード動画はありません", noUploadedVideosHelp: "参加者が録画してアップロードすると、転送、メタデータ、照合、レビュー状態がここに表示されます。",
    auditIntro: "タスク、参加者、動画照合の重要な変更を記録します。履歴は読み取り専用で、メンバー変更によって上書きされません。", recorded: "記録済み", operator: "操作者：{name}", object: "対象：{id}", changes: "変更内容：{fields}", moreChanges: " ほか {count} 件", reasonPrefix: "理由：", noActivity: "操作記録はありません", noActivityHelp: "参加者の追加や調整、バージョン公開、動画処理を行うと記録が表示されます。",
    assignmentsKicker: "固定タスクの配信", assignments: "タスク割り当て", createAssignment: "割り当てを作成", assignmentSearch: "割り当て / 参加者 / タスク", allStatuses: "すべての状態", taskVersion: "タスク版", due: "期限", statusSignals: "状態 / シグナル", missing: "不足", noAssignments: "割り当てはまだありません。", assignmentsBack: "割り当てに戻る", assignmentAuthorityHelp: "サーバーは有効状態、同意、公開済み版、機器の所有を再確認します。選択肢の組み合わせは権限を与えません。", publishedTaskVersion: "公開済みタスク版", preferredDevice: "優先機器", noDevice: "指定なし", locale: "言語地域", assignmentNote: "メモ", creating: "作成中…", assignmentCreateFailed: "割り当てを作成できませんでした。", manage: "管理", collapse: "閉じる", operationReasonMin: "操作理由（10 文字以上）", reasonMinError: "理由は 10 文字以上必要です。", extendNeedsDue: "延長する新しい期限を選択してください。", extend: "延長", operationFailed: "操作に失敗しました。",
    closeSession: "録画セッションを終了", closeReason: "終了理由（10 文字以上）", closeReasonError: "終了理由は 10 文字以上必要です。", closing: "終了中…", confirmClose: "終了を確認", closeSessionFailed: "録画セッションを終了できませんでした。",
    reviewKicker: "人による権限確認キュー", reviewCases: "レビュー項目", reviewIntro: "自動証拠は異常を示すだけです。業務上の関係は変更不能な照合判断と人が記録した理由で決まります。", allTypes: "すべての種類", case: "項目", type: "種類", relatedObject: "関連対象", unresolvedParticipant: "参加者未確定", noDecision: "判断なし", noMachineReason: "機械判定理由なし", noReviewCases: "現在の絞り込みに一致するレビュー項目はありません。", reviewBack: "レビュー待ちに戻る", matchHistory: "照合判断の履歴", noMatchDecisions: "照合判断はまだありません。", viewUpload: "アップロード詳細を見る", transfer: "転送", metadata: "メタデータ", assignment: "割り当て", participantClaim: "参加者の申告", supersedes: "{value} を置換", current: "現在", historical: "履歴", unmatchedValue: "未照合",
    humanAction: "人による操作", terminalReview: "このレビュー項目は終了しています。履歴は引き続き確認できます。", reviewAction: "操作", confirmCurrentMatch: "現在の照合を確認", correctSessionDevice: "セッション / 機器を修正", rejectUpload: "アップロードを却下", requestRerecord: "再録画を依頼", extendAssignment: "割り当てを延長", suspendParticipant: "参加者を停止", resolveWithoutMatch: "照合を変更せず解決", dismissCase: "レビュー項目を対象外にする", newDueAt: "新しい期限", changePreview: "変更プレビュー", confirmBeforeSubmit: "送信前の確認 · {subject}", before: "変更前", after: "変更後", chooseNewTime: "新しい時刻を選択", reasonHelp: "判断の証拠と変更理由を入力（10～500 文字）", reasonLengthError: "理由は 10～500 文字で入力してください。", retryReasonLengthError: "再試行理由は 10～500 文字で入力してください。", reviewDecisionFailed: "レビュー判断に失敗しました。", metadataRetryFailed: "メタデータの再試行に失敗しました。", submitImmutableDecision: "変更不能な判断を送信", retryMetadata: "メタデータを再試行",
    countryRegion: "国 / 地域", timezone: "タイムゾーン", currentValue: "現在の値", chooseSuggestion: "{field} の候補から値を選択してください", searchField: "{field} を検索", tablePagination: "表のページ送り", totalRows: "全 {count} 件 · {pages} ページ中 {page} ページ", rowsPerPage: "1 ページの行数", rowsPerPageAria: "1 ページあたりの行数", rows: "{count} 行", apply: "適用", goToPage: "ページへ移動", goToPageRange: "1 から {pages} のページへ移動", jump: "移動", previousPage: "前のページ", nextPage: "次のページ",
    recordsKicker: "タスク横断の収集運用", records: "収集記録", recordsIntro: "動画アップロード、録画セッション、主要操作をまとめて確認します。問題の処理は権威ある詳細画面と対応待ちキューで行います。", recordsSummary: "収集記録の概要", totalUploads: "全アップロード", transfersInProgress: "転送処理中", openSessions: "未終了セッション", needsAttention: "要確認", anomalyOverview: "問題の概要", duplicateCandidate: "重複候補", totalReviews: "レビュー総数", videoRecords: "動画記録", sessionRecords: "録画セッション", recordsView: "収集記録ビュー",
    videoRecordsIntro: "アップロードごとに転送、メタデータ、照合、人によるレビュー状態を確認します。アップロード不足は上の問題概要に別表示されます。", searchVideoRecords: "動画記録を検索", videoSearchPlaceholder: "ファイル名、参加者、タスク、録画セッション", transferStatus: "転送状態", allTransferStatuses: "すべての転送状態", metadataStatus: "メタデータ状態", allMetadataStatuses: "すべてのメタデータ状態", handlingStatus: "対応状態", allRecords: "すべての記録", attentionOnly: "要対応のみ", clearFilters: "絞り込みを解除", file: "ファイル", taskSession: "タスク / 録画セッション", recordStatusColumns: "転送 / メタデータ / 照合 / レビュー", sizeTime: "サイズ / 時刻", taskPending: "タスク未確定", claimed: "申告：", final: "最終：", notClaimed: "申告なし", awaitingConfirmation: "確認待ち", noVideoRecordsFiltered: "条件に一致する動画記録はありません", noVideoRecordsFilteredHelp: "条件を変更するか、絞り込みを解除して全アップロードを表示してください。", noVideoRecordsHelp: "参加者が録画してアップロードすると動画記録が表示されます。", viewTasks: "収集タスクを見る",
    sessionsIntro: "未終了セッションを既定で表示します。全履歴と終了済みセッションも検索でき、数時間または数日後に届いた動画を追跡できます。", searchSessions: "録画セッションを検索", sessionSearchPlaceholder: "録画セッション、参加者、タスク、割り当て", sessionStatus: "セッション状態", notClosed: "未終了", allHistory: "全履歴", taskDevice: "タスク / 機器", markerVideos: "マーカー / 動画", createdTime: "作成日時", closedAt: "終了 {date}", markerConfirmed: "マーカー確認済み", markerPending: "マーカー未確認", matchedVideos: "照合動画 {count} 件", viewRelatedVideos: "関連動画を見る", noSessionsFiltered: "条件に一致する録画セッションはありません", noOpenSessions: "未終了セッションはありません", noSessionsFilteredHelp: "条件を変更するか、既定の未終了セッション一覧に戻ってください。", noOpenSessionsHelp: "全履歴から終了済みセッションと遅れて届いた動画を追跡できます。",
    auditRecordsIntro: "読み取り専用の監査証拠をローカライズした概要で表示します。元の操作、リクエスト ID、変更 JSON は必要に応じて展開できます。", searchActivity: "操作記録を検索", activitySearchPlaceholder: "対象 ID、元の操作、操作者", actionCategory: "操作分類", allActions: "すべての操作", actor: "操作者", reasonChanges: "理由 / 変更概要", time: "時刻", noPublicId: "公開 ID なし", noReason: "理由未入力", changedFields: "変更：{fields}", noBeforeAfterChanges: "変更前 / 変更後フィールドの差分なし", viewChanges: "変更詳細を見る", rawAction: "元の操作：{value}", requestId: "リクエスト ID：{value}", noBeforeAfterJson: "変更前 / 変更後 JSON はありません。", noActivityFiltered: "条件に一致する操作記録はありません", noActivityFilteredHelp: "条件を変更するか、絞り込みを解除してすべての証拠を表示してください。", noActivityImmutableHelp: "主要操作は変更不能な監査記録へ自動的に書き込まれます。", categoryTask: "収集タスク", categoryParticipant: "参加者と機器", categoryAssignment: "割り当て", categorySession: "録画セッション", categoryUpload: "動画アップロード", categoryMetadata: "動画メタデータ", categoryReview: "照合とレビュー", categorySystem: "システムとその他",
    uploadsBack: "アップロード一覧に戻る", demoRetentionExpired: "デモオブジェクトの保持期限切れ", matchDevice: "照合 / 機器", objectClaim: "オブジェクトと参加者の申告", uploadAttempts: "アップロード試行", normalizedMetadata: "正規化メタデータ", metadataUnavailableIndependent: "メタデータはまだ利用できません。転送状態は独立して保持されます。", fieldEvidence: "フィールド証拠", noAllowlistEvidence: "許可リストのフィールド証拠はまだありません。", relatedReviews: "関連レビュー項目", noRelatedReviews: "関連レビュー項目はありません。", claimedSession: "申告された録画セッション", localModified: "ローカル更新時刻", participantNote: "参加者メモ", failureCode: "失敗コード", verifiedAt: "確認時刻", intentExpires: "アップロード意図の期限", videoAsset: "動画アセット", objectKey: "オブジェクトキー", parser: "解析器", container: "コンテナ", duration: "時間", video: "動画", audio: "音声", captureTime: "撮影時刻", camera: "カメラ", serialHmac: "シリアル HMAC", gpsPresent: "GPS メタデータあり", projection360: "投影 / 360", extracted: "抽出時刻", channels: "{count} チャンネル", not360: "360 ではない", expires: "期限 {date}", ranges: "範囲 {count}/24", fiveMinutePreview: "5 分間の非公開プレビュー", retryReason: "再試行理由（10～500 文字）", previewFailed: "プレビューリンクを作成できませんでした。",
    participantsBack: "参加者一覧に戻る", consent: "同意", region: "地域", managementEmail: "管理用メール", defaultDevice: "既定の機器", participantProfile: "参加者プロフィール", participantProfileHelp: "管理用メールは内部記録専用で、実際のメールは送信しません。メモに機密情報を入力しないでください。", displayAlias: "表示名", sensitiveNotesHelp: "500 文字まで。氏名、住所、身分証番号などの機密情報を入力しないでください。", saveParticipant: "参加者プロフィールを保存", invitationAndStatus: "招待と状態", invitationHashHelp: "招待リンクは一度だけ表示され、データベースには SHA-256 ハッシュのみ保存されます。", currentInvitation: "現在の招待：{status}", notGenerated: "未生成", fixtureProtected: "保護済みのため公開管理者は変更できません。", generateInvitation: "招待を生成 / 再発行", generating: "生成中…", oneTimeInvitationUrl: "一度限りの招待 URL", copyLink: "リンクをコピー", openNewWindow: "新しいウィンドウで開く", operationReason: "操作理由", minimum10: "10 文字以上", revokeInvitation: "招待を取り消す", pauseParticipant: "停止", reactivateParticipant: "再開", withdrawParticipant: "研究参加を終了", registerDevice: "機器を登録", manufacturer: "メーカー", model: "モデル", deviceTypePhone: "スマートフォン", deviceTypeActionCamera: "アクションカメラ", deviceTypeCamera: "カメラ", deviceTypeOther: "その他", serialHmacOnly: "シリアル（HMAC のみ保存）", firmware: "ファームウェア", setDefaultDevice: "既定の機器に設定", registering: "登録中…", updateReason: "変更理由（10～500 文字）", noDevices: "機器はまだ登録されていません。", invitationCreateFailed: "招待を生成できませんでした。", invitationRevokeFailed: "招待を取り消せませんでした。", statusChangeReasonError: "状態変更の理由は 10 文字以上必要です。", statusChangeFailed: "状態を変更できませんでした。", deviceCreateFailed: "機器を登録できませんでした。", participantUpdateFailed: "参加者を更新できませんでした。", deviceUpdateFailed: "機器を更新できませんでした。", createRegistryEntry: "登録情報を作成", createParticipant: "参加者を作成", createParticipantHelp: "まず下書きを作成し、その後一度限りのデモ招待を生成します。実際のメール送信は MVP の対象外です。", managementEmailNoSend: "管理用メール（送信なし）", newNotesHelp: "500 文字まで。氏名や電話番号などの機密情報を入力しないでください。", creatingParticipant: "作成中…", createDraftParticipant: "下書き参加者を作成", participantCreateFailed: "参加者を作成できませんでした。",
    participantList: { kicker: "参加者登録", filters: "参加者の絞り込み", allConsentStatuses: "すべての同意状態", allLocales: "すべての言語設定", allCountriesRegions: "すべての国 / 地域", allMissingSignals: "すべての不足状態", onlyMissing: "不足のみ", excludeMissing: "不足を除外", allReviewSignals: "すべてのレビュー状態", onlyNeedsReview: "レビュー要のみ", excludeNeedsReview: "レビュー要を除外" },
    participantDrawer: { viewAria: "{id} を表示", editAria: "{id} を編集", viewTitle: "参加者を表示", editTitle: "参加者を編集", viewSubtitle: "プロフィールと現在のログイン情報", editSubtitle: "基本プロフィールを更新", closeAria: "参加者サイドパネルを閉じる", loadingProfile: "参加者プロフィールを読み込み中…", reloadProfile: "再読み込み", profileLoadFailed: "参加者プロフィールを読み込めませんでした。再試行してください。", profileNetworkFailed: "参加者プロフィールを読み込めませんでした。ネットワークを確認して再試行してください。", basicProfile: "基本プロフィール", openFullDetails: "すべての詳細を開く", fixture: "デモデータ", loginInformation: "参加者のログイン情報", loginInformationHelp: "後から再表示・コピーできます。参加者サイトへのログインにのみ使用してください。", credentialMissing: "未生成", credentialPendingActivation: "有効化待ち", credentialPendingSync: "同期待ち", credentialReady: "同期済み", loginAddress: "ログイン先", loginAccount: "アカウント", copyAccount: "アカウントをコピー", copyPassword: "パスワードをコピー", passwordUnavailable: "表示できるパスワードはまだ生成されていません。", pendingActivationHelp: "パスワードは生成済みですが、参加者が招待を承諾して有効化するまでログインできません。", pendingSyncHelp: "パスワードの認証同期が完了していません。参加者へ渡す前に同期を続行してください。", readyBlockedHelp: "パスワードは同期済みですが、現在の参加者状態または同意状態ではログインできません。", readyCanLogin: "現在のログイン情報をそのまま使用できます。", fullLoginInformation: "ログイン先：{url}\nアカウント：{account}\nパスワード：{password}", copyFullLoginInformation: "ログイン情報一式をコピー", copied: "{label}をコピーしました。", copyFailed: "コピーできませんでした。テキストを選択して手動でコピーしてください。", generatePassword: "ログインパスワードを生成", continueSync: "同期を続行", resetPassword: "ログインパスワードをリセット", confirmGeneratePassword: "この参加者のログインパスワードを生成しますか？", confirmSyncPassword: "現在のパスワードを参加者アカウントへ引き続き同期しますか？", confirmResetPassword: "ログインパスワードをリセットしますか？以前のパスワードは直ちに無効になります。", processing: "処理中…", credentialOperationFailed: "パスワード操作に失敗しました。再試行してください。", credentialNetworkFailed: "パスワード操作に失敗しました。ネットワークを確認して再試行してください。", credentialSynced: "パスワードを同期しました。", credentialGenerated: "新しいログインパスワードを生成しました。以前のパスワードは無効です。", fixtureCredentialProtected: "このデモデータは保護されています。公開管理者はパスワードを生成・リセットできません。", fixtureEditProtected: "このデモデータは保護されています。公開管理者は表示できますが、変更を保存できません。", profileConflict: "別の操作でプロフィールが更新されました。最新の内容を読み込んだので、確認してから再度保存してください。", profileUpdateFailed: "参加者を更新できませんでした。再試行してください。", profileUpdateNetworkFailed: "参加者を更新できませんでした。ネットワークを確認して再試行してください。", saveChanges: "変更を保存" },
    removeItem: "{label} {number} を削除", enterCustomOption: "カスタム項目を入力してください", alreadyAdded: "「{value}」は追加済みです", maxItems: "最大 {count} 件まで追加できます", selectedLabel: "選択済み {label}", removeValue: "{label} から「{value}」を削除", nothingAdded: "まだ追加されていません。", addFromPreset: "プリセットから追加", choosePreset: "プリセットを選択", addCustomOption: "カスタム項目を追加", addCustom: "カスタム {label} を追加", add: "追加",
    removeModule: "{title} モジュールを削除", taskDraftSaveFailed: "タスクの下書きを保存できませんでした。内容を確認して再試行してください。", taskDraftSaved: "タスクの下書きを保存しました。", serverConnectionFailed: "サーバーに接続できません。ネットワークを確認して再試行してください。", taskPublishFailed: "タスク版を公開できませんでした。しばらくしてから再試行してください。", versionPublished: "バージョン {version} を公開しました。", basicInformation: "基本情報", basicInformationHelp: "参加者には最初にタイトル、説明、目標録画仕様が表示されます。* の項目は必須です。", taskTitle: "タスク名 *", taskTitleExample: "例：コーヒーを一杯作る", taskDescription: "タスク説明 *", taskDescriptionHelp: "参加者が行うことと、完了後に期待される結果を説明します。", recordingSpec: "録画仕様", recordingSpecHelp: "参加者向け説明とアップロード後のメタデータ検査目標に使用します。", targetDurationMinutes: "目標録画時間（分）*", durationToleranceMinutes: "許容時間差（± 分）*", targetResolution: "目標解像度 *", customResolution: "カスタム解像度…", customResolutionLabel: "カスタム解像度", resolutionExample: "例：1440p", targetFps: "目標フレームレート（FPS）*", customFps: "カスタムフレームレート…", customFpsLabel: "カスタムフレームレート", taskModulesHelp: "必要な説明モジュールを追加します。参加者画面では空でないモジュールが固定順で表示されます。", addInstructionModule: "説明モジュールを追加",
    moduleEnvironment: "環境と活動範囲", moduleSteps: "具体的な手順", moduleObjects: "必要な物", moduleMustShow: "必ず映す", moduleMustAvoid: "必ず避ける", moduleConstraints: "その他の録画条件", moduleCompletion: "完了条件", moduleUpload: "アップロード説明", modulePrivacy: "プライバシーチェック", environmentModuleHelp: "録画前の環境準備と活動できる範囲を説明します。", environmentExample: "例：キッチン台を明るく保つ", addEnvironment: "環境準備を追加", areaLimit: "活動範囲の制限", areaExample: "例：活動をキッチン内に限定する", addAreaLimit: "範囲制限を追加", stepsHelp: "手順の順序は参加者にそのまま表示され、期待する映像は各手順で残す証拠を示します。", stepNumber: "手順 {number}", moveStepUp: "手順 {number} を上へ", moveStepDown: "手順 {number} を下へ", deleteStep: "手順 {number} を削除", operationInstruction: "操作説明 *", operationInstructionHelp: "この手順で参加者が行う操作を説明", expectedVisualEvidence: "期待する映像証拠", cupExample: "例：コーヒーカップ", addStep: "手順を追加", objectsHelp: "タスクに必要な物と、映像に必ず映すかを指定します。", objectName: "物の名前 *", coffeeMakerExample: "例：コーヒーメーカー", mustBeVisible: "必ず映す", deleteObject: "必要な物 {number} を削除", addObject: "物を追加", mustShowHelp: "映像に継続または明確に映す内容を選択します。", processExample: "例：コーヒーを作る過程", mustAvoidHelp: "映像に含めない個人情報、反射、無関係な内容を選択します。", billExample: "例：家庭の請求書", constraintsHelp: "必ず映す / 避けるに分類できない実施条件を追加します。", recordingConstraint: "録画条件", constraintExample: "例：作業範囲へ頭を向け続ける", addConstraint: "録画条件を追加", completionHelp: "メタデータはファイルと技術仕様を検査し、内容の完了は研究者が確認します。", criterionDescription: "判定説明 *", criterionExample: "例：コーヒーの抽出が完了している", validationMethod: "確認方法", manualReviewLabel: "人による確認", metadataCheckLabel: "メタデータ確認", deleteCriterion: "完了条件 {number} を削除", addCriterion: "判定条件を追加", uploadModuleHelp: "動画の保存場所、アップロード方法、ネットワーク切断後の再開方法を説明します。", allowedFileSources: "許可するファイル取得元 *", cameraStorage: "カメラ内部ストレージ", uploadOperationInstructions: "アップロード操作説明", uploadOriginalExample: "例：カメラが生成した元ファイルを選択", addUploadInstruction: "アップロード説明を追加", recoveryInstructions: "中断後の再開説明", recoveryExample: "例：同じファイルを再選択して再開", addRecoveryInstruction: "再開説明を追加", privacyHelp: "アップロード前に参加者が確認するプライバシー要件です。", checklistItem: "確認項目", privacyExample: "例：映像に個人の写真が含まれていない", addPrivacyItem: "プライバシー項目を追加", noInstructionModules: "説明モジュールはまだありません", noInstructionModulesHelp: "「説明モジュールを追加」から環境、手順、映像要件、アップロード説明を追加してください。", systemRecordingRules: "システムの録画・照合ルール", firstPersonRule: "ヘッドマウント機器で一人称動画を録画します。", authorityRule: "参加者、タスク版、機器は割り当てと録画セッションから決まり、ファイル名からは決まりません。", creatingDraft: "下書きを作成中…", savingDraft: "下書きを保存中…", createDraft: "下書きを作成", saveDraft: "下書きを保存", publishingVersion: "バージョンを公開中…", saveDraftFirst: "先に下書きを保存", publishNewVersion: "新しいバージョンを公開",
    presetHands: "参加者の両手", presetProcess: "操作全体", presetTools: "使用中の道具", presetInitialEnvironment: "タスク開始前の環境", presetResult: "タスク完了後の結果", presetFace: "顔", presetMirror: "鏡", presetId: "身分証明書", presetAddress: "住所", presetNotifications: "画面通知", presetPhotos: "個人の写真", presetLocation: "位置情報", presetObject: "操作対象", presetInitialState: "タスク開始状態",
    validationInvalid: "この項目を確認して、もう一度お試しください。", validationTolerance: "許容差は目標録画時間より短くしてください", validationStepOrder: "録画手順は 1 から連続する順序にしてください", validationCodeUnique: "コードは重複できません", validationOverlap: "同じ内容を「必ず映す」と「必ず避ける」の両方に指定できません",
    chooseDueError: "新しい期限を選択してください。", chooseReplacementError: "代替参加者を選択してください。", replace: "交代", stop: "停止", replaceParticipant: "参加者を交代", stopParticipation: "参加を停止", adjustDue: "期限を調整", closePeopleManager: "参加者管理画面を閉じる", participantStats: "バージョン {version} · セッション {sessions} · 動画 {videos}", replaceHistoryHelp: "交代は元の参加者の今後の操作だけを停止します。既存の録画セッション、アップロード、動画は元の参加者に残り、移動しません。", replacementParticipant: "代替参加者", chooseAvailableParticipant: "利用可能な参加者を選択", sameAsOriginal: "元の記録と同じ", newDue: "新しい期限", noDeviceSpecified: "機器を指定しない", cancelHistoryHelp: "停止すると開いている録画セッションを終了し、新規セッションとアップロードを禁止します。最後の 1 人は単独で停止できないため、交代を使用してください。", reasonPlaceholder: "変更理由を 10 文字以上で入力", processing: "処理中…", stopAndAssign: "{name} を停止して割り当て", saveNewDue: "新しい期限を保存", removeFromRoster: "公開名簿から削除", closeRemoveParticipant: "参加者削除画面を閉じる", removeRosterHelp: "このタスクは未公開のため、割り当て、録画セッション、アップロード記録はありません。後から再追加または別の参加者へ変更できます。", removing: "削除中…", confirmRemove: "削除を確認", remove: "削除", rosterRemoveFailed: "公開名簿から削除できませんでした。再試行してください。",
    regionFilterAll: "地域を絞り込み、現在はすべての地域", regionFilterSelected: "地域を絞り込み、{count} 地域を選択済み", regionLabel: "地域", allRegions: "すべての地域", selectedCount: "{count} 件選択済み", regionOptions: "地域の選択肢", noRegions: "地域データなし", clearRegionFilter: "地域の絞り込みを解除", alreadyInRoster: "公開名簿に追加済み", alreadyInTask: "このタスクに追加済み", participantInactive: "参加者が有効ではありません", consentInvalid: "同意状態が無効です", eligible: "割り当て可能", chooseParticipantError: "参加者を 1 人以上選択してください。", addParticipantFailed: "参加者を追加できませんでした。ネットワークを確認して再試行してください。", addParticipants: "参加者を追加", addParticipantsIntro: "一度に 1 人以上を選択できます。各参加者に個別のタスク記録が作成されます。", closeAddParticipants: "参加者追加画面を閉じる", addParticipantsSteps: "参加者追加の手順", choosePeople: "参加者を選択", choosePeopleComplete: "参加者を選択、完了", devicesAndSettings: "機器と設定", joinedRoster: "公開名簿に追加 · {count} 人", participantsAdded: "{count} 人を追加しました", participantsSkipped: "{count} 人を追加できませんでした", shownSelected: "{shown} 人を表示、{selected} 人を選択済み", searchParticipants: "参加者を検索", participantSearchPlaceholder: "名前、ID、地域を検索", chooseName: "{name} を選択", noParticipantMatches: "一致する参加者はいません。検索内容を変更してください。", devicesSettingsHelp: "選択した {count} 人の機器を確認し、共通設定を入力します。", sharedSettings: "共通設定", sharedSettingsHelp: "以下の設定は今回選択した全員に適用されます。", latest: "最新", draftRosterHelp: "このタスクはまだ下書きです。参加者は先に公開名簿へ追加され、初回公開時に固定バージョンへ関連付けて正式な割り当てを作成します。", assignmentNotes: "割り当てメモ", visibleOptional: "任意、参加者に表示されます", perPersonDevice: "参加者ごとの機器", deviceOptionalHelp: "機器は未指定でも構いません。既定の機器がある場合は自動選択されています。", selectedPeople: "{count} 人選択済み", done: "完了", nextSettings: "次へ：機器と設定", previousStep: "前の手順", joining: "追加中…", assigning: "割り当て中…", joinRoster: "公開名簿に追加", assignCount: "{count} 人に割り当て",
  },
  labels: {
    taskOperational: { draft: "下書き", awaiting_participants: "参加者待ち", running: "進行中", needs_attention: "対応が必要", completed: "完了", archived: "アーカイブ済み" },
    matchDecision: { participant_claim: "参加者の申告", admin_confirmed: "管理者確認済み", admin_corrected: "管理者修正済み", unmatched: "未照合", rejected: "照合却下", pending: "照合待ち" },
    deviceConsistency: { matched: "一致", partial_match: "一部一致", metadata_unavailable: "メタデータ利用不可", model_mismatch: "モデル不一致", serial_mismatch: "シリアル番号不一致", metadata_conflict: "メタデータ競合" },
    captureTimeSource: { quicktime_with_timezone: "QuickTime（タイムゾーン付き）", container: "コンテナ", track: "動画トラック", local_modified: "ローカル更新日時", unknown: "不明" },
    recordHealth: { attention: "対応が必要", ready: "準備完了", progress: "処理中" },
    reviewCaseType: { missing: "アップロード不足", upload_failed: "アップロード失敗", metadata_failed: "メタデータ失敗", duplicate_candidate: "重複の可能性", unmatched: "未照合", device_mismatch: "機器不一致", needs_review: "レビュー要" },
    auditAction: Object.fromEntries(Object.keys(zhCN.labels.auditAction).map((key) => [key, japaneseIdentifierLabel(key)])) as unknown as I18nCatalog["labels"]["auditAction"],
    entity: { assignment: "割り当て", device: "収集機器", metadata: "動画メタデータ", participant: "参加者", recording_session: "録画セッション", review_case: "レビュー項目", task: "収集タスク", upload_attempt: "アップロード試行", upload_batch: "アップロードバッチ", upload_intent: "動画アップロード", video_asset: "動画アセット" },
    field: { participantPublicId: "参加者", replacementParticipantPublicId: "代替参加者", taskPublicId: "収集タスク", taskVersion: "タスク版", dueAt: "期限", status: "状態", preferredDevicePublicId: "優先機器", sessionPublicId: "録画セッション", devicePublicId: "機器" },
  },
  state: {
    "participant.status": { draft: "下書き", invited: "招待済み", expired: "期限切れ", active: "有効", suspended: "停止中", withdrawn: "辞退済み" },
    "participant.consent_status": { pending: "同意待ち", valid: "有効", expired: "期限切れ", withdrawn: "撤回済み" },
    "participant_invitation.status": { generated: "生成済み", opened: "開封済み", accepted: "承諾済み", revoked: "取消済み", expired: "期限切れ" },
    "consent_record.status": { accepted: "承諾済み", withdrawn: "撤回済み", expired: "期限切れ" },
    "device.status": { active: "有効", lost: "紛失", retired: "廃止", shared: "共有" },
    "task.lifecycle": { draft: "下書き", active: "進行中", archived: "アーカイブ済み" },
    "assignment.status": { assigned: "割当済み", acknowledged: "確認済み", session_created: "セッション作成済み", uploading: "アップロード中", submitted: "送信済み", needs_review: "レビュー要", rework_required: "再作業要", accepted: "承認済み", expired: "期限切れ", missing_upload: "アップロード不足", canceled: "キャンセル済み" },
    "recording_session.status": { open: "受付中", closed: "終了" },
    "upload_batch.status": { open: "受付中", completed: "完了", aborted: "中止", expired: "期限切れ" },
    "upload_intent.transfer_status": { created: "作成済み", uploading: "アップロード中", reconciling: "照合中", verified: "確認済み", failed: "失敗", aborted: "中止", expired: "期限切れ" },
    "upload_intent.metadata_status": { pending: "待機中", processing: "処理中", extracted: "抽出済み", partial: "一部抽出", unsupported: "非対応", failed: "失敗" },
    "upload_attempt.status": { created: "作成済み", uploading: "アップロード中", paused: "一時停止", completed: "完了", failed: "失敗", aborted: "中止", expired: "期限切れ" },
    "video_asset.status": { active: "有効", rejected: "却下", deleted: "削除済み" },
    "metadata_attempt.status": { processing: "処理中", extracted: "抽出済み", partial: "一部抽出", unsupported: "非対応", failed: "失敗" },
    "review_case.status": { open: "受付中", in_review: "レビュー中", resolved: "解決済み", dismissed: "対象外" },
  },
  stateAction: {
    "participant.status": { invite: "招待を送信", expireInvitation: "招待を期限切れにする", acceptInvitation: "招待を承諾", suspend: "停止", resume: "再開", withdraw: "辞退" },
    "participant.consent_status": { accept: "同意", expire: "期限切れにする", withdraw: "同意を撤回" },
    "participant_invitation.status": { open: "開く", accept: "承諾", revoke: "取消", expire: "期限切れにする" },
    "consent_record.status": {},
    "device.status": { markLost: "紛失として登録", share: "共有にする", activate: "有効化", retire: "廃止" },
    "task.lifecycle": { publish: "公開", archive: "アーカイブ" },
    "assignment.status": { acknowledge: "確認", createSession: "セッション作成", startUpload: "アップロード開始", submit: "送信", requireReview: "レビューを要求", requestRework: "再作業を要求", accept: "承認", expire: "期限切れにする", markMissing: "不足として登録", extendUnacknowledged: "延長", extendAcknowledged: "延長", cancel: "キャンセル" },
    "recording_session.status": { close: "終了" },
    "upload_batch.status": { complete: "完了", abort: "中止", expire: "期限切れにする" },
    "upload_intent.transfer_status": { start: "開始", reconcile: "照合", verify: "確認", fail: "失敗として登録", abort: "中止", expire: "期限切れにする" },
    "upload_intent.metadata_status": { start: "処理開始", extract: "抽出完了", partial: "一部抽出として登録", markUnsupported: "非対応として登録", fail: "失敗として登録", retry: "再試行" },
    "upload_attempt.status": { start: "開始", pause: "一時停止", complete: "完了", fail: "失敗として登録", abort: "中止", expire: "期限切れにする" },
    "video_asset.status": { reject: "却下", delete: "削除" },
    "metadata_attempt.status": { extract: "抽出完了", partial: "一部抽出として登録", markUnsupported: "非対応として登録", fail: "失敗として登録" },
    "review_case.status": { beginReview: "レビュー開始", resolve: "解決", dismiss: "対象外にする" },
  },
  errors: Object.fromEntries(Object.keys(zhCN.errors).map((code) => [code, japaneseErrorMessage(code as keyof typeof zhCN.errors)])) as unknown as I18nCatalog["errors"],
} satisfies I18nCatalog;

export const catalogs: Record<UiLocale, I18nCatalog> = { "zh-CN": zhCN, en, ja };

type LeafKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? LeafKeys<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string];

export type MessageKey = Exclude<LeafKeys<I18nCatalog>, `state.${string}` | `stateAction.${string}` | `errors.${string}`>;

function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function mapToUiLocale(value: string | null | undefined): UiLocale | null {
  if (!value) return null;
  let locale: Intl.Locale;
  try { locale = new Intl.Locale(value); } catch { return null; }
  if (locale.language === "zh") return "zh-CN";
  if (locale.language === "en") return "en";
  if (locale.language === "ja") return "ja";
  return null;
}

export function negotiateLocale(acceptLanguage: string | null | undefined): UiLocale | null {
  if (!acceptLanguage) return null;
  const candidates = acceptLanguage.split(",").map((entry, index) => {
    const [tag = "", ...parameters] = entry.trim().split(";");
    const qualityText = parameters.find((parameter) => parameter.trim().startsWith("q="))?.split("=")[1];
    const quality = qualityText === undefined ? 1 : Number.parseFloat(qualityText);
    return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
  }).sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const candidate of candidates) {
    if (candidate.quality <= 0 || candidate.tag === "*") continue;
    const locale = mapToUiLocale(candidate.tag);
    if (locale) return locale;
  }
  return null;
}

export function resolveUiLocale(input: { cookie?: string | null; profile?: string | null; acceptLanguage?: string | null }): UiLocale {
  return (isUiLocale(input.cookie) ? input.cookie : null)
    ?? mapToUiLocale(input.profile)
    ?? negotiateLocale(input.acceptLanguage)
    ?? DEFAULT_LOCALE;
}

function messageAt(catalog: I18nCatalog, key: string): string | undefined {
  let cursor: unknown = catalog;
  for (const part of key.split(".")) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

function interpolate(message: string, values: MessageValues = {}): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) => {
    const value = values[name];
    if (value === undefined || value === null) return token;
    return value instanceof Date ? value.toISOString() : String(value);
  });
}

export type DateFormatOptions = Intl.DateTimeFormatOptions;
export type NumberFormatOptions = Intl.NumberFormatOptions;

function localizedDisplayName(locale: UiLocale, type: "language" | "region", value: string): string {
  try {
    return new Intl.DisplayNames(locale, { type }).of(value) ?? value;
  } catch {
    // Historical/demo rows may predate canonical locale and region validation.
    // Keep their original value visible instead of failing the whole page.
    return value;
  }
}

export function createTranslator(locale: UiLocale, catalog: I18nCatalog = catalogs[locale]) {
  const t = (key: MessageKey, values?: MessageValues) => {
    const message = messageAt(catalog, key);
    if (!message) throw new Error(`Missing i18n message: ${locale}:${key}`);
    return interpolate(message, values);
  };
  const plural = (key: string, count: number, values: MessageValues = {}) => {
    const category = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
    const message = messageAt(catalog, `${key}.${category}`) ?? messageAt(catalog, `${key}.other`);
    if (!message) throw new Error(`Missing i18n plural: ${locale}:${key}`);
    return interpolate(message, { ...values, count });
  };
  const state = (machineId: string, value: string) => {
    const machine = (catalog.state as Record<string, Record<string, string>>)[machineId];
    return machine?.[value] ?? value.replaceAll("_", " ");
  };
  const action = (machineId: string, event: string) => {
    const machine = (catalog.stateAction as Record<string, Record<string, string>>)[machineId];
    return machine?.[event] ?? event.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
  };
  const label = (group: keyof I18nCatalog["labels"], value: string) => {
    const entries = catalog.labels[group] as Record<string, string>;
    return entries[value] ?? value;
  };
  const error = (code: string | null | undefined, values?: MessageValues) => {
    const messages = catalog.errors as Record<string, string>;
    return interpolate(messages[code ?? ""] ?? messages.UNKNOWN, values);
  };
  return {
    locale,
    t,
    plural,
    state,
    action,
    label,
    error,
    date: (value: Date | string | number, options?: DateFormatOptions) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    number: (value: number, options?: NumberFormatOptions) => new Intl.NumberFormat(locale, options).format(value),
    relativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit),
    bytes: (value: number) => new Intl.NumberFormat(locale, { style: "unit", unit: "byte", unitDisplay: "short", maximumFractionDigits: value < 1024 ? 0 : 1, notation: value >= 1_000_000 ? "compact" : "standard" }).format(value),
    duration: (seconds: number) => new Intl.NumberFormat(locale, { style: "unit", unit: seconds >= 60 ? "minute" : "second", unitDisplay: "long", maximumFractionDigits: 1 }).format(seconds >= 60 ? seconds / 60 : seconds),
    regionName: (region: string) => localizedDisplayName(locale, "region", region),
    languageName: (language: string) => localizedDisplayName(locale, "language", language),
  };
}

export type Translator = ReturnType<typeof createTranslator>;

export function assertCatalogParity(): void {
  const visit = (reference: unknown, candidate: unknown, path: string): void => {
    if (typeof reference === "string") {
      if (typeof candidate !== "string" || candidate.length === 0) throw new Error(`Missing catalog value: ${path}`);
      const placeholders = (message: string) => Array.from(message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g), (match) => match[1]).sort();
      if (placeholders(reference).join("\0") !== placeholders(candidate).join("\0")) throw new Error(`Catalog placeholders differ: ${path}`);
      return;
    }
    if (!reference || typeof reference !== "object" || !candidate || typeof candidate !== "object") throw new Error(`Catalog shape mismatch: ${path}`);
    const expected = Object.keys(reference as object).sort();
    const actual = Object.keys(candidate as object).sort();
    if (expected.join("\0") !== actual.join("\0")) throw new Error(`Catalog keys differ: ${path}`);
    for (const key of expected) visit((reference as Record<string, unknown>)[key], (candidate as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
  };
  for (const locale of SUPPORTED_LOCALES) visit(zhCN, catalogs[locale], locale);
  for (const [machineId, machine] of Object.entries(lifecycleMachines)) {
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = catalogs[locale];
      for (const stateValue of machine.definition.states) {
        if (!(catalog.state as Record<string, Record<string, string>>)[machineId]?.[stateValue]) throw new Error(`Missing state label: ${locale}:${machineId}:${stateValue}`);
      }
      for (const event of Object.keys(machine.definition.transitions)) {
        if (!(catalog.stateAction as Record<string, Record<string, string>>)[machineId]?.[event]) throw new Error(`Missing state action: ${locale}:${machineId}:${event}`);
      }
    }
  }
}
