import * as vscode from "vscode";
import { updateStatusBarItem } from "./extension";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "onInfo": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage(data.value);
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
        case "saveWater": {
            const currentSaved = this._context.globalState.get<number>('totalWaterSaved', 0);
            await this._context.globalState.update('totalWaterSaved', currentSaved + data.value);
            updateStatusBarItem(this._context);
            break;
        }
        case "wasteWater": {
            const currentWasted = this._context.globalState.get<number>('totalWaterWasted', 0);
            await this._context.globalState.update('totalWaterWasted', currentWasted + data.value);
            break;
        }
        case "getState": {
            webviewView.webview.postMessage({
                type: 'state',
                saved: this._context.globalState.get<number>('totalWaterSaved', 0),
                wasted: this._context.globalState.get<number>('totalWaterWasted', 0)
            });
            break;
        }
        case "fetchSearch": {
          try {
            const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(data.query)}`);
            if (!response.ok) throw new Error('Search failed');
            const html = await response.text();
            webviewView.webview.postMessage({ type: 'searchResult', success: true, html });
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'searchResult', success: false, error: error.message });
          }
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "style.css")
    );
    
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
\t\t\t<html lang="en">
\t\t\t<head>
\t\t\t\t<meta charset="UTF-8">
\t\t\t\t<!--
\t\t\t\t\tUse a content security policy to only allow loading images from https or from our extension directory,
\t\t\t\t\tand only allow scripts that have a specific nonce.
\t\t\t\t-->
\t\t\t\t<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' blob:;">
\t\t\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t\t\t\t<link href="${styleResetUri}" rel="stylesheet">
\t\t\t\t<link href="${styleVSCodeUri}" rel="stylesheet">
\t\t\t\t<link href="${styleMainUri}" rel="stylesheet">
\t\t\t\t<title>Google It First</title>
\t\t\t</head>
\t\t\t<body>
        <div id="app">
            <div id="chat-interface">
                <div class="chat-header">
                    <h2>Fake AI Chat</h2>
                    <p>Ask a question below!</p>
                </div>
                <!-- Chat log simulation -->
                <div id="chat-log"></div>
                <!-- Input area -->
                <div class="chat-input-area">
                    <textarea id="prompt-input" placeholder="Ask AI..."></textarea>
                    <button id="submit-btn" aria-label="Send">➡️</button>
                </div>
            </div>
            
            <!-- Google It First Overlay (Injected directly here for simplicity) -->
            <div id="gf-overlay">
                <div id="gf-card">
                    <!-- overlay contents will be injected by main.js -->
                </div>
            </div>
        </div>
\t\t\t\t<script nonce="${nonce}">
                    const tsvscode = acquireVsCodeApi();
                </script>
\t\t\t\t<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
\t\t\t</body>
\t\t\t</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
