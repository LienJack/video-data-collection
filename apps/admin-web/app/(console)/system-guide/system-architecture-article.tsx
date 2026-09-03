import type { UiLocale } from "@egocapture/core/i18n";
import { TreeStructure } from "@phosphor-icons/react/dist/ssr";
import type { GuidePageContent } from "./guide-content";
import { LocalizedGuideArticle } from "./localized-guide-article";

export function SystemArchitectureArticle({ locale, content }: { locale: UiLocale; content: GuidePageContent }) {
  return (
    <LocalizedGuideArticle
      id="system-architecture"
      number="01"
      icon={<TreeStructure className="size-6" weight="duotone" />}
      statuses={["current", "boundary"]}
      locale={locale}
      content={content.articles.architecture}
      pageContent={content}
      diagram="system-architecture"
    />
  );
}
