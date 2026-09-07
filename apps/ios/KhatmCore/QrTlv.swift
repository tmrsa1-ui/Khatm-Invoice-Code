import Foundation

public struct KhatmTlvField: Sendable {
    public var tag: Int
    public var length: Int
    public var text: String
}

public struct KhatmQrResult: Sendable {
    public var status: String
    public var findings: [String]
    public var fields: [KhatmTlvField]
}

public enum KhatmQrTlv {
    public static let officialSample =
        "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA=="

    public static func inspect(_ raw: String) -> KhatmQrResult {
        let compact = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if compact.isEmpty {
            return KhatmQrResult(status: "NOT_CHECKED", findings: ["empty"], fields: [])
        }
        if compact.contains("://") {
            return KhatmQrResult(status: "FAILED", findings: ["QR-URL-PAYLOAD"], fields: [])
        }
        guard let data = Data(base64Encoded: compact) else {
            return KhatmQrResult(status: "FAILED", findings: ["QR-INVALID-BASE64"], fields: [])
        }
        var fields: [KhatmTlvField] = []
        var i = 0
        let bytes = [UInt8](data)
        while i < bytes.count {
            if i + 2 > bytes.count {
                return KhatmQrResult(status: "FAILED", findings: ["QR-TLV-TRUNCATED"], fields: fields)
            }
            let tag = Int(bytes[i])
            let length = Int(bytes[i + 1])
            i += 2
            if i + length > bytes.count {
                return KhatmQrResult(status: "FAILED", findings: ["QR-TLV-TRUNCATED"], fields: fields)
            }
            let slice = bytes[i..<(i + length)]
            let text = String(bytes: slice, encoding: .utf8) ?? ""
            fields.append(KhatmTlvField(tag: tag, length: length, text: text))
            i += length
        }
        return KhatmQrResult(status: "PASS_LOCAL_RULES", findings: ["QR-TLV-OK"], fields: fields)
    }
}
