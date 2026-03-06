import SwiftUI
import WebKit

private enum AppThemeStyle: String, CaseIterable, Identifiable {
    case system
    case cupertino
    case graphite
    case emerald

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "System"
        case .cupertino: return "Cupertino"
        case .graphite: return "Graphite"
        case .emerald: return "Emerald"
        }
    }

    var gradient: LinearGradient {
        switch self {
        case .system:
            return LinearGradient(
                colors: [Color(.systemGroupedBackground), Color(.secondarySystemGroupedBackground)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .cupertino:
            return LinearGradient(
                colors: [Color(red: 0.91, green: 0.95, blue: 1.0), Color(red: 0.96, green: 0.98, blue: 1.0)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .graphite:
            return LinearGradient(
                colors: [Color(red: 0.14, green: 0.16, blue: 0.22), Color(red: 0.08, green: 0.10, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .emerald:
            return LinearGradient(
                colors: [Color(red: 0.90, green: 0.98, blue: 0.95), Color(red: 0.84, green: 0.96, blue: 0.90)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    var textPrimary: Color {
        switch self {
        case .graphite: return .white
        default: return .primary
        }
    }

    var panelBackground: Color {
        switch self {
        case .graphite: return Color.white.opacity(0.10)
        default: return Color.white.opacity(0.92)
        }
    }
}

private enum TicketStatusFilter: String, CaseIterable, Identifiable {
    case all = "ALL"
    case received = "RECEIVED"
    case diagnosis = "DIAGNOSIS"
    case quoteReady = "QUOTE_READY"
    case waitingForApproval = "WAITING_FOR_APPROVAL"
    case partsOrdered = "PARTS_ORDERED"
    case sentToCustomer = "SENT_TO_CUSTOMER"
    case closed = "CLOSED"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Wszystkie"
        case .received: return "Przyjęte"
        case .diagnosis: return "Diagnoza"
        case .quoteReady: return "Kosztorys"
        case .waitingForApproval: return "Czeka na zgodę"
        case .partsOrdered: return "Części"
        case .sentToCustomer: return "Wysłane"
        case .closed: return "Zamknięte"
        }
    }
}

private enum TicketPriorityOption: String, CaseIterable, Identifiable {
    case low = "LOW"
    case normal = "NORMAL"
    case high = "HIGH"
    case urgent = "URGENT"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .low: return "Niski"
        case .normal: return "Normalny"
        case .high: return "Wysoki"
        case .urgent: return "Pilny"
        }
    }
}

private struct TicketDashboardMetrics {
    let total: Int
    let open: Int
    let urgent: Int
    let active: Int
    let closed: Int
}

private enum TicketWorkflow {
    static let orderedStatuses: [String] = [
        "RECEIVED",
        "DIAGNOSIS",
        "QUOTE_READY",
        "PARTS_ORDERED",
        "WAITING_FOR_APPROVAL",
        "SENT_TO_CUSTOMER",
        "CLOSED",
    ]
}

private enum IOSInterfaceMode: String, CaseIterable, Identifiable {
    case unifiedWeb
    case nativeSwift

    var id: String { rawValue }

    var title: String {
        switch self {
        case .unifiedWeb: return "Unified WebUI (1:1)"
        case .nativeSwift: return "Native iOS"
        }
    }
}

struct ContentView: View {
    @StateObject private var networkManager = NetworkManager()
    @State private var showScanner = false
    @State private var connectionURL = ""
    @State private var loginEmail = ""
    @State private var loginPassword = ""
    @AppStorage("iosThemeStyle") private var themeRaw = AppThemeStyle.cupertino.rawValue
    @AppStorage("iosInterfaceMode") private var interfaceModeRaw = IOSInterfaceMode.unifiedWeb.rawValue

    private var theme: AppThemeStyle {
        AppThemeStyle(rawValue: themeRaw) ?? .cupertino
    }

    private var interfaceMode: IOSInterfaceMode {
        IOSInterfaceMode(rawValue: interfaceModeRaw) ?? .unifiedWeb
    }

    var body: some View {
        Group {
            switch networkManager.connectionStatus {
            case .disconnected:
                PairingView(
                    showScanner: $showScanner,
                    connectionURL: $connectionURL,
                    networkManager: networkManager,
                    theme: theme
                )
            case .scanning:
                ConnectionProgressView(
                    title: "Skanowanie QR",
                    subtitle: "Odczytuję konfigurację serwera...",
                    theme: theme
                )
            case .connecting(let url):
                ConnectionProgressView(
                    title: "Łączenie z serwerem",
                    subtitle: url,
                    theme: theme
                )
            case .connected(let url):
                if networkManager.isAuthenticated {
                    ConnectedRootView(
                        apiBase: url,
                        networkManager: networkManager,
                        theme: theme,
                        onThemeChange: { themeRaw = $0.rawValue },
                        interfaceMode: interfaceMode,
                        onInterfaceModeChange: { interfaceModeRaw = $0.rawValue }
                    )
                } else {
                    AuthRequiredView(
                        apiBase: url,
                        loginEmail: $loginEmail,
                        loginPassword: $loginPassword,
                        networkManager: networkManager,
                        theme: theme
                    )
                }
            case .error(let message):
                ConnectionErrorView(
                    message: message,
                    networkManager: networkManager,
                    showScanner: $showScanner,
                    theme: theme
                )
            }
        }
        .sheet(isPresented: $showScanner) {
            QRCodeScanner { qrString in
                Task {
                    await networkManager.processQRData(qrString)
                }
            }
        }
    }
}

private struct PairingView: View {
    @Binding var showScanner: Bool
    @Binding var connectionURL: String
    @ObservedObject var networkManager: NetworkManager
    let theme: AppThemeStyle

    var body: some View {
        ZStack {
            theme.gradient.ignoresSafeArea()

            VStack(spacing: 18) {
                Spacer()

                VStack(spacing: 10) {
                    Image(systemName: "iphone.gen3.radiowaves.left.and.right")
                        .font(.system(size: 56, weight: .semibold))
                        .foregroundStyle(theme.textPrimary)
                    Text("Połącz iPhone z OpenTicket")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(theme.textPrimary)
                    Text("Zeskanuj kod QR z konfiguracji serwera albo wpisz ręcznie URL API.")
                        .font(.subheadline)
                        .foregroundStyle(theme.textPrimary.opacity(0.85))
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)

                VStack(spacing: 12) {
                    Button {
                        showScanner = true
                    } label: {
                        Label("Skanuj QR", systemImage: "qrcode.viewfinder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)

                    HStack {
                        Rectangle().fill(theme.textPrimary.opacity(0.2)).frame(height: 1)
                        Text("lub")
                            .font(.caption)
                            .foregroundStyle(theme.textPrimary.opacity(0.7))
                        Rectangle().fill(theme.textPrimary.opacity(0.2)).frame(height: 1)
                    }

                    TextField("http://192.168.1.20:3200", text: $connectionURL)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Button {
                        Task {
                            do {
                                try await networkManager.connect(apiBaseUrl: connectionURL)
                            } catch {
                                networkManager.connectionStatus = .error("Nie udało się połączyć: \(error.localizedDescription)")
                            }
                        }
                    } label: {
                        Label("Połącz ręcznie", systemImage: "network")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(16)
                .background(theme.panelBackground)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 20)

                Spacer()

                Text("Tip: pod testy z USB-C uruchom `./Moj/testy/start-ios-device.sh`")
                    .font(.caption2)
                    .foregroundStyle(theme.textPrimary.opacity(0.75))
                    .padding(.bottom, 8)
            }
        }
    }
}

private struct ConnectionProgressView: View {
    let title: String
    let subtitle: String
    let theme: AppThemeStyle

    var body: some View {
        ZStack {
            theme.gradient.ignoresSafeArea()

            VStack(spacing: 14) {
                ProgressView()
                    .controlSize(.large)
                Text(title)
                    .font(.headline)
                    .foregroundStyle(theme.textPrimary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(theme.textPrimary.opacity(0.8))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
    }
}

private struct AuthRequiredView: View {
    let apiBase: String
    @Binding var loginEmail: String
    @Binding var loginPassword: String
    @ObservedObject var networkManager: NetworkManager
    let theme: AppThemeStyle
    @State private var isLoggingIn = false

    var body: some View {
        NavigationView {
            ZStack {
                theme.gradient.ignoresSafeArea()

                VStack(spacing: 18) {
                    Spacer(minLength: 16)

                    VStack(spacing: 6) {
                        Text("OpenTicket iOS")
                            .font(.largeTitle.weight(.bold))
                            .foregroundStyle(theme.textPrimary)
                        Text("Zaloguj się, aby pracować na zgłoszeniach")
                            .font(.subheadline)
                            .foregroundStyle(theme.textPrimary.opacity(0.8))
                    }

                    VStack(spacing: 12) {
                        TextField("E-mail", text: $loginEmail)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textFieldStyle(.roundedBorder)

                        SecureField("Hasło", text: $loginPassword)
                            .textFieldStyle(.roundedBorder)

                        Button {
                            Task {
                                isLoggingIn = true
                                defer { isLoggingIn = false }
                                do {
                                    try await networkManager.login(email: loginEmail, password: loginPassword)
                                } catch {
                                    networkManager.errorMessage = "Logowanie nieudane: \(error.localizedDescription)"
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                if isLoggingIn {
                                    ProgressView().tint(.white)
                                }
                                Text(isLoggingIn ? "Logowanie..." : "Zaloguj")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isLoggingIn)

                        if let error = networkManager.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .padding(16)
                    .background(theme.panelBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 20)

                    VStack(spacing: 6) {
                        Text("Połączono z")
                            .font(.caption)
                            .foregroundStyle(theme.textPrimary.opacity(0.7))
                        Text(apiBase)
                            .font(.caption.monospaced())
                            .foregroundStyle(theme.textPrimary)
                    }

                    Button("Zmień serwer") {
                        networkManager.disconnect()
                    }
                    .buttonStyle(.bordered)

                    Spacer()
                }
            }
            .navigationTitle("Logowanie")
        }
    }
}

private struct ConnectedRootView: View {
    let apiBase: String
    @ObservedObject var networkManager: NetworkManager
    let theme: AppThemeStyle
    let onThemeChange: (AppThemeStyle) -> Void
    let interfaceMode: IOSInterfaceMode
    let onInterfaceModeChange: (IOSInterfaceMode) -> Void

    @State private var selectedTab = 0
    @State private var selectedStatusPreset: TicketStatusFilter = .all

    var body: some View {
        if interfaceMode == .unifiedWeb {
            TabView(selection: $selectedTab) {
                UnifiedWebShellScreen(
                    apiBase: apiBase,
                    authToken: networkManager.sessionToken
                )
                .tabItem {
                    Label("OpenTicket", systemImage: "globe")
                }
                .tag(0)

                SettingsScreen(
                    apiBase: apiBase,
                    networkManager: networkManager,
                    theme: theme,
                    onThemeChange: onThemeChange,
                    interfaceMode: interfaceMode,
                    onInterfaceModeChange: onInterfaceModeChange
                )
                .tabItem {
                    Label("Ustawienia", systemImage: "gearshape")
                }
                .tag(1)
            }
        } else {
            TabView(selection: $selectedTab) {
                DashboardHomeView(
                    networkManager: networkManager,
                    selectedStatusPreset: $selectedStatusPreset,
                    openTicketsTab: { selectedTab = 1 },
                    theme: theme
                )
                .tabItem {
                    Label("Dashboard", systemImage: "rectangle.grid.2x2")
                }
                .tag(0)

                TicketListScreen(
                    networkManager: networkManager,
                    selectedStatusPreset: $selectedStatusPreset,
                    theme: theme
                )
                .tabItem {
                    Label("Zgłoszenia", systemImage: "list.bullet.rectangle")
                }
                .tag(1)

                SettingsScreen(
                    apiBase: apiBase,
                    networkManager: networkManager,
                    theme: theme,
                    onThemeChange: onThemeChange,
                    interfaceMode: interfaceMode,
                    onInterfaceModeChange: onInterfaceModeChange
                )
                .tabItem {
                    Label("Ustawienia", systemImage: "gearshape")
                }
                .tag(2)
            }
        }
    }
}

private final class UnifiedWebViewStore: NSObject, ObservableObject, WKNavigationDelegate {
    @Published var isLoading = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var currentUrl = ""
    @Published var errorMessage: String?

    let webView: WKWebView
    private var loadedApiBase = ""

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        self.webView = webView
        super.init()
        self.webView.navigationDelegate = self
    }

    func load(apiBase: String, authToken: String?) {
        let normalizedBase = normalizeApiBase(apiBase)
        guard let baseUrl = URL(string: normalizedBase) else {
            errorMessage = "Niepoprawny adres serwera: \(apiBase)"
            return
        }
        injectRuntimeSession(token: authToken, apiBase: normalizedBase)
        let dashboardUrl = baseUrl.appendingPathComponent("dashboard")

        if loadedApiBase != normalizedBase || webView.url == nil {
            webView.load(URLRequest(url: dashboardUrl, cachePolicy: .reloadIgnoringLocalCacheData))
            loadedApiBase = normalizedBase
            return
        }

        if authToken != nil {
            webView.reload()
        }
    }

    func reload() {
        webView.reload()
    }

    func goBack() {
        if webView.canGoBack {
            webView.goBack()
        }
    }

    func goForward() {
        if webView.canGoForward {
            webView.goForward()
        }
    }

    private func normalizeApiBase(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private func injectRuntimeSession(token: String?, apiBase: String) {
        let sanitizedBase = jsEscape(apiBase)
        let sanitizedToken = jsEscape(token ?? "")
        let scriptSource = """
        try {
          if ('\(sanitizedToken)'.length > 0) {
            localStorage.setItem('ts_auth_token', '\(sanitizedToken)');
          }
          localStorage.setItem('ts_api_base_url', '\(sanitizedBase)');
        } catch (e) {}
        """
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(
            WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
    }

    private func jsEscape(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        errorMessage = nil
        currentUrl = webView.url?.absoluteString ?? currentUrl
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        currentUrl = webView.url?.absoluteString ?? currentUrl
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        errorMessage = "Błąd ładowania WebUI: \(error.localizedDescription)"
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        errorMessage = "Błąd połączenia z WebUI: \(error.localizedDescription)"
    }
}

private struct UnifiedWebViewRepresentable: UIViewRepresentable {
    @ObservedObject var store: UnifiedWebViewStore

    func makeUIView(context: Context) -> WKWebView {
        store.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

private struct UnifiedWebShellScreen: View {
    let apiBase: String
    let authToken: String?
    @StateObject private var store = UnifiedWebViewStore()
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Button {
                        store.goBack()
                    } label: {
                        Image(systemName: "chevron.backward")
                    }
                    .disabled(!store.canGoBack)
                    .buttonStyle(.bordered)

                    Button {
                        store.goForward()
                    } label: {
                        Image(systemName: "chevron.forward")
                    }
                    .disabled(!store.canGoForward)
                    .buttonStyle(.bordered)

                    Button {
                        store.reload()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)

                    Spacer()

                    Button {
                        if let url = URL(string: "\(apiBase.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/dashboard") {
                            openURL(url)
                        }
                    } label: {
                        Label("Safari", systemImage: "safari")
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemBackground))

                if store.isLoading {
                    ProgressView("Ładowanie OpenTicket WebUI...")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Color(.systemBackground))
                }

                if let error = store.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.08))
                }

                UnifiedWebViewRepresentable(store: store)
                    .onAppear {
                        store.load(apiBase: apiBase, authToken: authToken)
                    }
                    .onChange(of: apiBase) { _, value in
                        store.load(apiBase: value, authToken: authToken)
                    }
                    .onChange(of: authToken) { _, value in
                        store.load(apiBase: apiBase, authToken: value)
                    }
            }
            .navigationTitle("OpenTicket")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct DashboardHomeView: View {
    @ObservedObject var networkManager: NetworkManager
    @Binding var selectedStatusPreset: TicketStatusFilter
    let openTicketsTab: () -> Void
    let theme: AppThemeStyle

    private var metrics: TicketDashboardMetrics {
        let all = networkManager.tickets
        let openStatuses: Set<String> = ["RECEIVED", "DIAGNOSIS", "QUOTE_READY", "PARTS_ORDERED", "WAITING_FOR_APPROVAL", "SENT_TO_CUSTOMER", "NEW", "IN_PROGRESS"]
        let closedStatuses: Set<String> = ["CLOSED", "ARCHIVED", "RESOLVED"]
        let open = all.filter { openStatuses.contains($0.status.uppercased()) }.count
        let urgent = all.filter { $0.priority.uppercased() == "URGENT" }.count
        let active = all.filter { ["DIAGNOSIS", "IN_PROGRESS", "PARTS_ORDERED", "QUOTE_READY"].contains($0.status.uppercased()) }.count
        let closed = all.filter { closedStatuses.contains($0.status.uppercased()) }.count
        return .init(total: all.count, open: open, urgent: urgent, active: active, closed: closed)
    }

    var body: some View {
        NavigationView {
            ZStack {
                theme.gradient.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Panel technika")
                                    .font(.title2.weight(.bold))
                                Text("Szybki podgląd i skróty")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button {
                                Task { try? await networkManager.fetchTickets() }
                            } label: {
                                Label("Odśwież", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(.bordered)
                        }

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            StatCard(title: "Wszystkie", value: metrics.total, icon: "tray.full", color: .blue)
                            StatCard(title: "Otwarte", value: metrics.open, icon: "folder", color: .indigo)
                            StatCard(title: "Pilne", value: metrics.urgent, icon: "flame", color: .orange)
                            StatCard(title: "Zamknięte", value: metrics.closed, icon: "checkmark.seal", color: .green)
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Szybkie przełączniki")
                                .font(.headline)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(TicketStatusFilter.allCases) { status in
                                        Button(status.label) {
                                            selectedStatusPreset = status
                                            openTicketsTab()
                                        }
                                        .buttonStyle(.bordered)
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(theme.panelBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Ostatnie zgłoszenia")
                                .font(.headline)
                            ForEach(networkManager.tickets.prefix(4)) { ticket in
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(ticket.title)
                                            .font(.subheadline.weight(.semibold))
                                            .lineLimit(1)
                                        Text(ticket.ownerDisplayName)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    StatusBadge(status: ticket.status)
                                }
                                .padding(.vertical, 4)
                            }
                            if networkManager.tickets.isEmpty {
                                Text("Brak zgłoszeń.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(theme.panelBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Dashboard")
            .task {
                if networkManager.tickets.isEmpty {
                    try? await networkManager.fetchTickets()
                }
            }
        }
    }
}

private struct TicketListScreen: View {
    @ObservedObject var networkManager: NetworkManager
    @Binding var selectedStatusPreset: TicketStatusFilter
    let theme: AppThemeStyle

    @State private var query = ""
    @State private var minAgeDays = ""
    @State private var selectedStatus: TicketStatusFilter = .all
    @State private var onlyMine = false
    @State private var showNewTicketSheet = false
    @State private var isReloading = false

    var body: some View {
        NavigationView {
            ZStack {
                theme.gradient.ignoresSafeArea()

                VStack(spacing: 10) {
                    filterPanel

                    if networkManager.isLoading {
                        Spacer()
                        ProgressView("Ładowanie zgłoszeń...")
                        Spacer()
                    } else if let error = networkManager.errorMessage {
                        Spacer()
                        VStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.title2)
                            Text(error)
                                .multilineTextAlignment(.center)
                                .foregroundStyle(.secondary)
                            Button("Ponów") {
                                Task { await applyFilters() }
                            }
                            .buttonStyle(.bordered)
                        }
                        Spacer()
                    } else {
                        List {
                            ForEach(networkManager.tickets) { ticket in
                                NavigationLink(destination: TicketDetailScreen(ticket: ticket, networkManager: networkManager, theme: theme)) {
                                    TicketRow(ticket: ticket)
                                }
                            }
                        }
                        .listStyle(.plain)
                        .refreshable {
                            await applyFilters()
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }
            .navigationTitle("Zgłoszenia")
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    Button {
                        Task { await applyFilters() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }

                    Button {
                        showNewTicketSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewTicketSheet) {
                NewTicketSheet(networkManager: networkManager)
            }
            .onAppear {
                selectedStatus = selectedStatusPreset
                Task {
                    await applyFilters()
                }
            }
            .onChange(of: selectedStatusPreset) { _, newValue in
                selectedStatus = newValue
                Task {
                    await applyFilters()
                }
            }
        }
    }

    private var filterPanel: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Szukaj po tytule, numerze, kliencie...", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .padding(10)
            .background(theme.panelBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            HStack(spacing: 8) {
                Picker("Status", selection: $selectedStatus) {
                    ForEach(TicketStatusFilter.allCases) { item in
                        Text(item.label).tag(item)
                    }
                }
                .pickerStyle(.menu)
                .padding(8)
                .background(theme.panelBackground)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                TextField("> X dni", text: $minAgeDays)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 90)

                Toggle("Moje", isOn: $onlyMine)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }

            HStack(spacing: 8) {
                Button("Zastosuj filtry") {
                    Task { await applyFilters() }
                }
                .buttonStyle(.borderedProminent)

                Button("Wyczyść") {
                    query = ""
                    minAgeDays = ""
                    onlyMine = false
                    selectedStatus = .all
                    selectedStatusPreset = .all
                    Task { await applyFilters() }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(12)
        .background(theme.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func applyFilters() async {
        guard !isReloading else { return }
        isReloading = true
        defer { isReloading = false }

        let age = Int(minAgeDays.trimmingCharacters(in: .whitespacesAndNewlines))
        do {
            try await networkManager.fetchTickets(
                search: query,
                status: selectedStatus.rawValue,
                onlyMine: onlyMine,
                minAgeDays: age
            )
            selectedStatusPreset = selectedStatus
        } catch {
            // handled via observable errorMessage
        }
    }
}

private struct NewTicketSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var networkManager: NetworkManager

    @State private var title = ""
    @State private var description = ""
    @State private var customerName = ""
    @State private var customerEmail = ""
    @State private var priority: TicketPriorityOption = .normal
    @State private var isSaving = false
    @State private var localError: String?

    var body: some View {
        NavigationView {
            Form {
                Section("Nowe zgłoszenie") {
                    TextField("Tytuł", text: $title)
                    TextField("Opis usterki (min. 10 znaków)", text: $description, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                    Picker("Priorytet", selection: $priority) {
                        ForEach(TicketPriorityOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                }

                Section("Dane klienta (opcjonalnie)") {
                    TextField("Imię i nazwisko", text: $customerName)
                    TextField("E-mail", text: $customerEmail)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Dodaj zgłoszenie")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Zapisywanie..." : "Zapisz") {
                        Task {
                            await saveTicket()
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func saveTicket() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }

        do {
            try await networkManager.createTicket(
                title: title,
                description: description,
                priority: priority.rawValue,
                customerName: customerName,
                customerEmail: customerEmail
            )
            dismiss()
        } catch {
            localError = error.localizedDescription
        }
    }
}

private struct TicketRow: View {
    let ticket: Ticket

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(ticket.title)
                        .font(.headline)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        if let number = ticket.number {
                            Text("#\(number)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                        Text(ticket.ownerDisplayName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                StatusBadge(status: ticket.status)
            }

            Text(ticket.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            HStack {
                PriorityBadge(priority: ticket.priority)
                Spacer()
                Text(formatDate(ticket.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct TicketDetailScreen: View {
    let ticket: Ticket
    @ObservedObject var networkManager: NetworkManager
    let theme: AppThemeStyle

    @State private var detail: TicketDetail?
    @State private var selectedStatus: String
    @State private var isUpdatingStatus = false
    @State private var localError: String?

    init(ticket: Ticket, networkManager: NetworkManager, theme: AppThemeStyle) {
        self.ticket = ticket
        self.networkManager = networkManager
        self.theme = theme
        _selectedStatus = State(initialValue: ticket.status.uppercased())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                headerCard
                statusCard
                descriptionCard
                timelineCard
                commentsCard
                attachmentsCard
            }
            .padding(14)
        }
        .background(theme.gradient.ignoresSafeArea())
        .navigationTitle("Szczegóły")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await reloadDetail()
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(ticket.title)
                .font(.title3.weight(.bold))
            HStack(spacing: 8) {
                StatusBadge(status: detail?.status ?? ticket.status)
                PriorityBadge(priority: detail?.priority ?? ticket.priority)
                Spacer()
                if let number = detail?.number ?? ticket.number {
                    Text("#\(number)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            Divider()
            InfoRow(label: "Klient", value: detail?.ownerDisplayName ?? ticket.ownerDisplayName)
            InfoRow(label: "Technik", value: detail?.assigneeDisplayName ?? ticket.assigneeDisplayName)
            InfoRow(label: "Utworzono", value: formatDateTime(detail?.createdAt ?? ticket.createdAt))
            InfoRow(label: "Aktualizacja", value: formatDateTime(detail?.updatedAt ?? ticket.updatedAt))
        }
        .cardStyle()
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Etap zgłoszenia")
                .font(.headline)

            Picker("Status", selection: $selectedStatus) {
                ForEach(TicketWorkflow.orderedStatuses, id: \.self) { status in
                    Text(localizedStatus(status)).tag(status)
                }
            }
            .pickerStyle(.menu)

            Button {
                Task {
                    await saveStatus()
                }
            } label: {
                HStack {
                    if isUpdatingStatus {
                        ProgressView().tint(.white)
                    }
                    Text(isUpdatingStatus ? "Zapisywanie..." : "Zapisz etap")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isUpdatingStatus)

            if let localError {
                Text(localError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .cardStyle()
    }

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Opis usterki")
                .font(.headline)
            Text(detail?.description ?? ticket.description)
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .cardStyle()
    }

    private var timelineCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Historia etapów")
                .font(.headline)
            if let history = detail?.statusHistory, !history.isEmpty {
                ForEach(history.prefix(6)) { event in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(localizedStatus(event.fromStatus ?? "NOWE")) → \(localizedStatus(event.toStatus))")
                            .font(.subheadline.weight(.semibold))
                        Text("\(formatDateTime(event.changedAt)) · \(event.user?.name ?? "System")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 3)
                }
            } else {
                Text("Brak historii etapów.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .cardStyle()
    }

    private var commentsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Komentarze")
                .font(.headline)
            if let comments = detail?.comments, !comments.isEmpty {
                ForEach(comments.prefix(6)) { comment in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(comment.author?.name ?? "Użytkownik")
                            .font(.caption.weight(.semibold))
                        Text(comment.body)
                            .font(.subheadline)
                        Text(formatDateTime(comment.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(8)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            } else {
                Text("Brak komentarzy.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .cardStyle()
    }

    private var attachmentsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Załączniki")
                .font(.headline)
            if let attachments = detail?.attachments, !attachments.isEmpty {
                ForEach(attachments.prefix(6)) { attachment in
                    HStack {
                        Image(systemName: "paperclip")
                        VStack(alignment: .leading) {
                            Text(attachment.filename)
                                .font(.subheadline)
                            Text(formatDateTime(attachment.createdAt))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            } else {
                Text("Brak załączników.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .cardStyle()
    }

    private func reloadDetail() async {
        do {
            let loaded = try await networkManager.fetchTicketDetail(id: ticket.id)
            detail = loaded
            selectedStatus = loaded.status.uppercased()
            localError = nil
        } catch {
            localError = "Nie udało się pobrać szczegółów: \(error.localizedDescription)"
        }
    }

    private func saveStatus() async {
        guard !isUpdatingStatus else { return }
        isUpdatingStatus = true
        defer { isUpdatingStatus = false }

        do {
            try await networkManager.updateTicketStatus(ticketId: ticket.id, status: selectedStatus)
            await reloadDetail()
        } catch {
            localError = "Nie udało się zapisać etapu: \(error.localizedDescription)"
        }
    }
}

private struct SettingsScreen: View {
    let apiBase: String
    @ObservedObject var networkManager: NetworkManager
    let theme: AppThemeStyle
    let onThemeChange: (AppThemeStyle) -> Void
    let interfaceMode: IOSInterfaceMode
    let onInterfaceModeChange: (IOSInterfaceMode) -> Void

    @State private var showDisconnectAlert = false

    var body: some View {
        NavigationView {
            Form {
                Section("Połączenie") {
                    InfoRow(label: "API", value: apiBase)
                    InfoRow(label: "Status", value: "Połączono")
                }

                Section("Konto") {
                    InfoRow(label: "Użytkownik", value: networkManager.sessionUser?.name ?? networkManager.sessionUser?.email ?? "Brak")
                    InfoRow(label: "Rola", value: networkManager.sessionUser?.role ?? "-")
                }

                Section("Wygląd") {
                    Picker("Motyw", selection: Binding(
                        get: { theme },
                        set: { onThemeChange($0) }
                    )) {
                        ForEach(AppThemeStyle.allCases) { style in
                            Text(style.title).tag(style)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section("Ekosystem UI") {
                    Picker("Tryb interfejsu", selection: Binding(
                        get: { interfaceMode },
                        set: { onInterfaceModeChange($0) }
                    )) {
                        ForEach(IOSInterfaceMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.menu)

                    Text("Aby zachować identyczny wygląd i logikę między iOS, macOS, Windows i Web, wybierz „Unified WebUI (1:1)”.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Sesja") {
                    Button {
                        networkManager.logout()
                    } label: {
                        Label("Wyloguj", systemImage: "person.crop.circle.badge.minus")
                    }

                    Button(role: .destructive) {
                        showDisconnectAlert = true
                    } label: {
                        Label("Rozłącz serwer", systemImage: "power")
                    }
                }
            }
            .navigationTitle("Ustawienia")
            .alert("Rozłączyć serwer?", isPresented: $showDisconnectAlert) {
                Button("Rozłącz", role: .destructive) {
                    networkManager.disconnect()
                }
                Button("Anuluj", role: .cancel) {}
            } message: {
                Text("Usunie zapisany adres API i token logowania z iPhone.")
            }
        }
    }
}

private struct ConnectionErrorView: View {
    let message: String
    let networkManager: NetworkManager
    @Binding var showScanner: Bool
    let theme: AppThemeStyle

    var body: some View {
        ZStack {
            theme.gradient.ignoresSafeArea()

            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 46))
                    .foregroundStyle(.orange)
                Text("Błąd połączenia")
                    .font(.headline)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 24)

                Button("Skanuj ponownie") {
                    showScanner = true
                }
                .buttonStyle(.borderedProminent)

                Button("Reset połączenia") {
                    networkManager.disconnect()
                }
                .buttonStyle(.bordered)
                Spacer()
            }
        }
    }
}

private struct StatCard: View {
    let title: String
    let value: Int
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: icon)
                    .foregroundStyle(color)
            }
            Text("\(value)")
                .font(.title.bold())
                .foregroundStyle(.primary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct StatusBadge: View {
    let status: String

    private var style: (text: String, color: Color) {
        switch status.uppercased() {
        case "RECEIVED": return ("PRZYJĘTE", .blue)
        case "DIAGNOSIS": return ("DIAGNOZA", .orange)
        case "QUOTE_READY": return ("KOSZTORYS", .purple)
        case "PARTS_ORDERED": return ("CZĘŚCI", .indigo)
        case "WAITING_FOR_APPROVAL": return ("CZEKA NA ZGODĘ", .yellow)
        case "SENT_TO_CUSTOMER": return ("WYSŁANE", .teal)
        case "CLOSED": return ("ZAMKNIĘTE", .green)
        case "ARCHIVED": return ("ARCHIWUM", .mint)
        case "IN_PROGRESS": return ("W TOKU", .orange)
        case "WAITING_FOR_CUSTOMER": return ("CZEKA NA KLIENTA", .yellow)
        case "NEW": return ("NOWE", .blue)
        default: return (status.uppercased(), .gray)
        }
    }

    var body: some View {
        Text(style.text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(style.color.opacity(0.18))
            .foregroundStyle(style.color)
            .clipShape(Capsule())
    }
}

private struct PriorityBadge: View {
    let priority: String

    private var style: (text: String, color: Color) {
        switch priority.uppercased() {
        case "URGENT": return ("PILNY", .red)
        case "HIGH": return ("WYSOKI", .orange)
        case "NORMAL": return ("NORMALNY", .blue)
        case "LOW": return ("NISKI", .green)
        default: return (priority.uppercased(), .gray)
        }
    }

    var body: some View {
        Text(style.text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(style.color.opacity(0.16))
            .foregroundStyle(style.color)
            .clipShape(Capsule())
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .multilineTextAlignment(.trailing)
        }
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.92))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private func localizedStatus(_ status: String) -> String {
    switch status.uppercased() {
    case "RECEIVED": return "Przyjęte"
    case "DIAGNOSIS": return "Diagnoza"
    case "QUOTE_READY": return "Kosztorys"
    case "PARTS_ORDERED": return "Części zamówione"
    case "WAITING_FOR_APPROVAL": return "Czeka na zgodę"
    case "SENT_TO_CUSTOMER": return "Wysłane do klienta"
    case "CLOSED": return "Zamknięte"
    case "ARCHIVED": return "Archiwum"
    case "NEW": return "Nowe"
    case "IN_PROGRESS": return "W toku"
    case "WAITING_FOR_CUSTOMER": return "Czeka na klienta"
    case "RESOLVED": return "Rozwiązane"
    default: return status
    }
}

private func formatDate(_ isoString: String) -> String {
    String(isoString.prefix(10))
}

private func formatDateTime(_ isoString: String) -> String {
    if let date = ISO8601DateFormatter().date(from: isoString) {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    return String(isoString.prefix(19))
}

#Preview {
    ContentView()
}
