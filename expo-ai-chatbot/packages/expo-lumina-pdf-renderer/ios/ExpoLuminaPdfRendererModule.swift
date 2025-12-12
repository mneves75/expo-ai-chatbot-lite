import ExpoModulesCore
import Foundation
import PDFKit
import UIKit

public class ExpoLuminaPdfRendererModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoLuminaPdfRenderer")

    AsyncFunction("renderPdfPagesToPngs") { (pdfUri: String, options: [String: Any]?, promise: Promise) in
      do {
        let urls = try self.renderPdfPagesToPngs(pdfUri: pdfUri, options: options ?? [:])
        promise.resolve(urls)
      } catch {
        promise.reject("PDF_RENDER_ERROR", error.localizedDescription, error)
      }
    }
  }

  private func renderPdfPagesToPngs(pdfUri: String, options: [String: Any]) throws -> [String] {
    guard let url = URL(string: pdfUri) ?? URL(string: pdfUri.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") else {
      throw NSError(domain: "ExpoLuminaPdfRenderer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid pdfUri"])
    }

    let scale = (options["scale"] as? Double) ?? 2.0
    let maxPages = (options["maxPages"] as? Int) ?? 200

    guard let document = PDFDocument(url: url) else {
      throw NSError(domain: "ExpoLuminaPdfRenderer", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to open PDF"])
    }

    let pageCount = min(document.pageCount, maxPages)
    if pageCount <= 0 {
      return []
    }

    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    let outDir = caches.appendingPathComponent("lumina-pdf-pages", isDirectory: true)
    try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

    var results: [String] = []
    results.reserveCapacity(pageCount)

    for pageIndex in 0..<pageCount {
      autoreleasepool {
        guard let page = document.page(at: pageIndex) else { return }
        let bounds = page.bounds(for: .mediaBox)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

        UIGraphicsBeginImageContextWithOptions(size, true, 1.0)
        guard let ctx = UIGraphicsGetCurrentContext() else {
          UIGraphicsEndImageContext()
          return
        }

        // White background
        ctx.setFillColor(UIColor.white.cgColor)
        ctx.fill(CGRect(origin: .zero, size: size))

        ctx.saveGState()
        ctx.translateBy(x: 0, y: size.height)
        ctx.scaleBy(x: scale, y: -scale)
        page.draw(with: .mediaBox, to: ctx)
        ctx.restoreGState()

        let image = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        guard let pngData = image?.pngData() else { return }

        let fileName = "page-\(pageIndex + 1).png"
        let fileUrl = outDir.appendingPathComponent(fileName)
        try? pngData.write(to: fileUrl, options: .atomic)
        results.append(fileUrl.absoluteString)
      }
    }

    return results
  }
}

