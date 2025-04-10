export async function mock(){
  console.log("mock", this)
  let graph = `
  \`\`\`mermaid
  graph TD
      A[Glucose/Glycogen] -->|Glycolysis| B(Pyruvate)
      B -->|Krebs Cycle| C(NADH + FADH2)
      C -->|Electron Transport Chain| D(Proton Gradient)
      D -->|Drives ATP Synthase| E(ADP + Pi)
      E --> F(ATP)
      G[Fats] -->|Beta-Oxidation| C
      H[Proteins] -->|Amino Acid Breakdown| C
      I[Creatine Phosphate] -->|Quick Burst| E
  \`\`\``
  let response = `"Hello! How can I assist you today? 
  <q>1</q>
  <q>Can you provide an analysis of a specific historical event?</q>
  <q>How can I improve my daily productivity and time management?</q>
`
  setTimeout(() => {
    this.onResponse({content: response, responseId:"123"})
  }, 1000)
}