import SwiftUI

struct InspectView: View {
    @State private var payload = ""
    @State private var result: KhatmQrResult?
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("فحص محلي. ليست تابعة لزاتكا. ليست اعتمادًا.")
                    .font(.footnote)
                Text("C14N11 INCONCLUSIVE — XSD NOT_CHECKED")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextEditor(text: $payload).frame(minHeight: 120)
                HStack {
                    Button("افحص") { result = KhatmQrTlv.inspect(payload) }
                    Button("عيّنة") { payload = KhatmQrTlv.officialSample }
                }
                if let result {
                    Text(result.status).bold()
                    ForEach(result.fields, id: \.tag) { f in
                        Text("\(f.tag): \(f.text)")
                    }
                    ForEach(result.findings, id: \.self) { Text($0) }
                }
                Spacer()
            }
            .padding()
            .navigationTitle("ختم فاتورة")
        }
    }
}
