import type { UiLocale } from "@egocapture/core/i18n";
import type { ReactNode } from "react";
import { Conclusion, FactGrid, GuideArticle, GuideDiagram, GuideSection, ReferenceList, StepList } from "./guide-components";
import type { GuideArticleContent, GuidePageContent, GuideStatus } from "./guide-content";

export function LocalizedGuideArticle({
  id,
  number,
  icon,
  statuses,
  locale,
  content,
  pageContent,
  diagram,
  conclusionTone,
}: {
  id: string;
  number: string;
  icon: ReactNode;
  statuses: GuideStatus[];
  locale: UiLocale;
  content: GuideArticleContent;
  pageContent: GuidePageContent;
  diagram: string;
  conclusionTone?: "blue" | "amber" | "violet";
}) {
  return (
    <GuideArticle
      id={id}
      number={number}
      eyebrow={content.eyebrow}
      title={content.title}
      summary={content.summary}
      statuses={statuses}
      statusLabels={pageContent.statusLabels}
      icon={icon}
    >
      <Conclusion label={pageContent.conclusionLabel} tone={conclusionTone}>{content.conclusion}</Conclusion>
      <GuideDiagram
        title={content.diagramTitle}
        description={content.diagramDescription}
        actionLabel={pageContent.openDiagramLabel}
        src={`/system-guide/diagrams/${locale}/${diagram}.html`}
      />
      {content.sections.map((section) => (
        <GuideSection key={`${section.eyebrow}-${section.title}`} title={section.title} eyebrow={section.eyebrow}>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.steps ? <StepList items={section.steps} /> : null}
          {section.facts ? <FactGrid items={section.facts} /> : null}
        </GuideSection>
      ))}
      {content.references ? (
        <ReferenceList
          items={content.references}
          label={pageContent.referencesLabel}
          newTabLabel={pageContent.newTabLabel}
        />
      ) : null}
    </GuideArticle>
  );
}
