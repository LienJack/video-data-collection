import { FlowArrow } from "@phosphor-icons/react/dist/ssr";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, StepList } from "./guide-components";

export function SystemWorkflowArticle() {
  return (
    <GuideArticle
      id="system-workflow"
      number="02"
      eyebrow="双端联动"
      title="管理员与参与者如何完成一次采集"
      summary="以一次采集为主线，说明管理员如何发起和收口、参与者如何准备和提交，以及系统如何在两者之间核验、反馈和保留恢复入口。"
      statuses={["current"]}
      icon={<FlowArrow className="size-6" weight="duotone" />}
    >
      <Conclusion>
        一次采集完成不等于上传进度达到 100%。只有参与者按固定要求完成录制并提交原文件、系统确认文件完整且归属清楚，并由管理员接受结果或完成重录、纠正、拒绝等处置，这次采集才真正闭环。
      </Conclusion>

      <GuideDiagram
        title="一次采集的管理员、参与者与系统协作流程"
        description="主路径展示从定义目标到管理员接受；异常支路展示如何联系、纠正或重录后回到闭环。"
        src="/system-guide/diagrams/system-workflow.html"
      />

      <GuideSection title="一次采集的五个业务阶段" eyebrow="从发起到接受">
        <StepList
          items={[
            {
              title: "管理员准备并发起",
              description: (
                <>
                  管理员写清采集目标、执行步骤、画面要求、禁止事项、设备要求和截止时间，选择合适的参与者并发布。发布后，本次要求保持固定，避免参与者执行过程中被悄悄改变。
                </>
              ),
            },
            {
              title: "参与者理解并准备",
              description: (
                <>
                  参与者收到任务后阅读完整要求，检查设备、电量、存储空间和现场条件，再明确确认。条件不满足时应在录制前反馈并暂缓，避免事后才发现整段素材无效。
                </>
              ),
            },
            {
              title: "参与者完成一次可追踪的录制",
              description: (
                <>
                  参与者先建立一次采集会话，确认本次设备与现场标记，再按要求使用外部设备录制。结束后保留未经改写的原始视频，为后续上传、核验和必要的重试保留依据。
                </>
              ),
            },
            {
              title: "参与者提交，系统核验",
              description: (
                <>
                  参与者手动选择正确的采集会话和原文件，开始可暂停、可继续的直传。系统依次显示“传输中”“文件核验中”“待人工确认”等状态，不用一个上传百分比代替完整结果。
                </>
              ),
            },
            {
              title: "管理员复核并收口",
              description: (
                <>
                  管理员跟踪未开始、录制中、上传中、待复核和异常项目。正常素材予以接受；逾期、上传卡住、文件异常或归属不清时，联系参与者并选择延期、纠正、拒绝或要求重录，同时保留处置原因。
                </>
              ),
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="每次交接都要有可见结果" eyebrow="责任交接">
        <FactGrid
          items={[
            {
              label: "任务发出",
              value: "管理员负责发起；参与者能看到固定要求、执行步骤和截止时间，才算交接成功。",
            },
            {
              label: "录制开始",
              value: "参与者负责执行；页面确认本次采集会话已经建立，并给出可核对的现场标记。",
            },
            {
              label: "文件提交",
              value: "参与者把责任交给系统；字节传完后进入“核验中”，不会直接显示为采集完成。",
            },
            {
              label: "异常转交",
              value: "系统把原因、影响和建议动作交给管理员，而不是只显示一个无法解释的失败状态。",
            },
            {
              label: "采集收口",
              value: "管理员作最终业务处置；结果明确显示“已接受”，或清楚说明需要重录、纠正或拒绝。",
            },
            {
              label: "参与者回执",
              value: "参与者能看到提交结果与下一步；被要求重录时，原记录仍保留，避免同一问题反复沟通。",
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="失败后如何继续" eyebrow="异常闭环">
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4">
            <strong className="block text-[var(--ink)]">未开始或逾期</strong>
            管理员联系参与者，选择延期、替换或取消，并让项目进度反映真实风险。
          </li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4">
            <strong className="block text-[var(--ink)]">录制条件不满足</strong>
            参与者在开始前反馈并暂缓；条件恢复后仍从准备阶段继续。
          </li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4">
            <strong className="block text-[var(--ink)]">上传中断</strong>
            参与者可暂停或稍后继续，系统保留远端已经确认的进度，不要求整段视频从头上传。
          </li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4">
            <strong className="block text-[var(--ink)]">文件或归属异常</strong>
            系统不自动猜测；管理员比较任务、参与者和现场证据后纠正，必要时要求重录。
          </li>
        </ul>
        <p>
          当前上传仍由参与者手动选择对应的采集会话。视频中的二维码自动识别、自动分类和自动纠正不属于当前能力，也不作为一次采集完成的前提。
        </p>
      </GuideSection>
    </GuideArticle>
  );
}
