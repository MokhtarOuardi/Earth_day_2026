import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

let myStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "google-it-first" is now active!');

    // Register Webview Provider
    const sidebarProvider = new SidebarProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "googleItFirst.sidebar",
            sidebarProvider
        )
    );

    // Register Command to Open Sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('googleItFirst.openSidebar', () => {
            vscode.commands.executeCommand('workbench.view.extension.google-it-first-explorer');
        })
    );

    // Create Status Bar Item to track saved water
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'googleItFirst.openSidebar';
    context.subscriptions.push(myStatusBarItem);

    // Initial update of status bar
    updateStatusBarItem(context);
}

export function updateStatusBarItem(context: vscode.ExtensionContext) {
    const totalWaterSaved = context.globalState.get<number>('totalWaterSaved', 0);
    myStatusBarItem.text = `$(heart) ${totalWaterSaved}ml saved`;
    myStatusBarItem.tooltip = `Google It First! You have saved ${totalWaterSaved}ml of AI water so far!`;
    myStatusBarItem.show();
}

export function deactivate() {}
