// Renders a JSON-LD <script> tag. Escapes `<` so admin-entered content
// (product names, descriptions, blog bodies) can never break out of the
// script tag or inject markup — JSON.stringify alone doesn't guard against
// a literal "</script>" inside a string value.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
