// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "KhatmInvoice",
  defaultLocalization: "ar",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [.library(name: "KhatmCore", targets: ["KhatmCore"])],
  targets: [
    .target(name: "KhatmCore", path: "KhatmCore"),
  ]
)
