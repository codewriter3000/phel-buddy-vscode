const vscode = require("vscode");
const { TOKEN_TYPES, getDiagnostics, getSemanticTokens } = require("./phelAnalysis");

function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("phel");
  const semanticLegend = new vscode.SemanticTokensLegend(TOKEN_TYPES, []);

  context.subscriptions.push(diagnosticCollection);

  const semanticProvider = {
    provideDocumentSemanticTokens(document) {
      const builder = new vscode.SemanticTokensBuilder(semanticLegend);
      const tokens = getSemanticTokens(document.getText());

      for (const token of tokens) {
        builder.push(token.line, token.start, token.length, token.type, 0);
      }

      return builder.build();
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "phel" },
      semanticProvider,
      semanticLegend
    )
  );

  function updateDiagnostics(document) {
    if (document.languageId !== "phel") {
      return;
    }

    const documentDiagnostics = getDiagnostics(document.getText()).map((item) => {
      const range = new vscode.Range(item.line, item.start, item.line, item.end);
      const severity =
        item.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;

      return new vscode.Diagnostic(range, item.message, severity);
    });

    diagnosticCollection.set(document.uri, documentDiagnostics);
  }

  for (const document of vscode.workspace.textDocuments) {
    updateDiagnostics(document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => updateDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri))
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
