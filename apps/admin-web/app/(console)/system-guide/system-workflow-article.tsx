import type { UiLocale } from "@egocapture/core/i18n";
import { FlowArrow } from "@phosphor-icons/react/dist/ssr";
import type { GuidePageContent } from "./guide-content";
import { LocalizedGuideArticle } from "./localized-guide-article";

export function SystemWorkflowArticle({ locale, content }: { locale: UiLocale; content: GuidePageContent }) {
  return (
    <LocalizedGuideArticle
      id="system-workflow"
      number="02"
      icon={<FlowArrow className="size-6" weight="duotone" />}
      statuses={["current"]}
      locale={locale}
      content={content.articles.workflow}
      pageContent={content}
      diagram="system-workflow"
    />
  );
}
