export type QtiV3Item = {
  identifier: string
  title?: string

  // In a full implementation, this would be the QTI 3.0 XML (or JSON-ified representation)
  // and related responseProcessing templates.
  xml: string

  // Minimal metadata hooks.
  interactionType?: string
  stimulusHtml?: string
}

export function isProbablyQtiXml(xml: string): boolean {
  const s = xml.trim()
  return s.startsWith('<') && (s.includes('assessmentItem') || s.includes('qti-assessment-item'))
}
