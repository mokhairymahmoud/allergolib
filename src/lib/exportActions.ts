import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

export async function printHtml(html: string) {
  if (Platform.OS === "web") {
    // expo-print on web prints the current page, so print the sheet from its own window.
    const printWindow = window.open("", "_blank");
    if (!printWindow) throw new Error("Popup blocked");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }
  await Print.printAsync({ html });
}

export async function shareHtmlAsPdf(html: string) {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}

export async function shareText(message: string) {
  await Share.share({ message });
}

export const canSharePdf = Platform.OS !== "web";
