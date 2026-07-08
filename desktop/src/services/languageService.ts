export const OCR_LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "tel", label: "Telugu" },
  { code: "san", label: "Sanskrit" },
  { code: "hin", label: "Hindi / Devanagari" },
  { code: "tel+eng", label: "Telugu + English" },
  { code: "san+hin+eng", label: "Sanskrit Devanagari + English" },
  {
    code: "tel+san+hin+eng",
    label: "Telugu + Sanskrit + Devanagari + English",
  },
];

export function getLanguageLabel(code: string): string {
  return OCR_LANGUAGES.find((language) => language.code === code)?.label ?? code;
}