import SwiftUI

struct ContentView: View {
    @StateObject private var networkManager = NetworkManager()
    @State private var showScanner = false
    @State private var connectionURL = ""
    
    var body: some View {
        Group {
            switch networkManager.connectionStatus {
            case .disconnected:
                DisconnectedView(
                    showScanner: $showScanner,
                    connectionURL: $connectionURL,
                    networkManager: networkManager
                )
            
            case .scanning:
                VStack(spacing: 16) {
                    ProgressView("Scanning...")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            
            case .connecting(let url):
                VStack(spacing: 16) {
                    ProgressView("Connecting to \(url)...")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            
            case .connected(let url):
                ConnectedView(
                    apiBase: url,
                    networkManager: networkManager
                )
            
            case .error(let message):
                ErrorView(
                    message: message,
                    networkManager: networkManager,
                    showScanner: $showScanner
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

// MARK: - Disconnected View (QR Scanner)
struct DisconnectedView: View {
    @Binding var showScanner: Bool
    @Binding var connectionURL: String
    let networkManager: NetworkManager
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            VStack(spacing: 12) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 64))
                    .foregroundColor(.blue)
                
                Text("Connect to System")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Scan the QR code from your desktop ticket system")
                    .font(.body)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            
            Spacer()
            
            Button(action: { showScanner = true }) {
                HStack {
                    Image(systemName: "camera.viewfinder")
                    Text("Scan QR Code")
                }
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)
            }
            
            // Manual entry option
            VStack(spacing: 12) {
                Text("or")
                    .foregroundColor(.gray)
                
                TextField("Enter API URL", text: $connectionURL)
                    .textFieldStyle(.roundedBorder)
                    .placeholder(when: connectionURL.isEmpty) {
                        Text("http://192.168.1.100:3000").foregroundColor(.gray)
                    }
                
                Button(action: {
                    let qrData = """
                    {"apiBase":"\(connectionURL)","token":"temporary-pairing-token"}
                    """
                    Task {
                        await networkManager.processQRData(qrData)
                    }
                }) {
                    HStack {
                        Image(systemName: "network")
                        Text("Connect")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
            .padding(16)
            .background(Color(.systemGray6))
            .cornerRadius(8)
            
            Spacer()
        }
        .padding(24)
        .navigationTitle("Ticket System")
    }
}

// MARK: - Connected View (Tabbed Interface)
struct ConnectedView: View {
    let apiBase: String
    let networkManager: NetworkManager
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Tickets Tab
            TicketsView(networkManager: networkManager)
                .tabItem {
                    Image(systemName: "list.bullet")
                    Text("Tickets")
                }
                .tag(0)
            
            // Settings Tab
            SettingsView(apiBase: apiBase, networkManager: networkManager)
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(1)
        }
        .navigationTitle("Ticket System")
    }
}

// MARK: - Tickets View
struct TicketsView: View {
    @ObservedObject var networkManager: NetworkManager
    
    var body: some View {
        NavigationView {
            Group {
                if networkManager.isLoading {
                    VStack {
                        ProgressView("Loading tickets...")
                    }
                } else if let error = networkManager.errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.title)
                        Text(error)
                            .multilineTextAlignment(.center)
                        
                        Button("Retry") {
                            Task {
                                try? await networkManager.fetchTickets()
                            }
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(24)
                } else if networkManager.tickets.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.circle")
                            .font(.title)
                        Text("No Tickets")
                            .font(.headline)
                        Text("All caught up!")
                            .foregroundColor(.gray)
                    }
                } else {
                    List {
                        ForEach(networkManager.tickets) { ticket in
                            NavigationLink(destination: TicketDetailView(ticket: ticket)) {
                                TicketRow(ticket: ticket)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Tickets")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        Task {
                            try? await networkManager.fetchTickets()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .onAppear {
                Task {
                    try? await networkManager.fetchTickets()
                }
            }
        }
    }
}

// MARK: - Ticket Row
struct TicketRow: View {
    let ticket: Ticket
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(ticket.title)
                    .font(.headline)
                
                Spacer()
                
                StatusBadge(status: ticket.status)
            }
            
            Text(ticket.description)
                .font(.caption)
                .foregroundColor(.gray)
                .lineLimit(2)
            
            HStack(spacing: 12) {
                PriorityBadge(priority: ticket.priority)
                
                Spacer()
                
                Text(formatDate(ticket.createdAt))
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
        }
        .padding(.vertical, 8)
    }
    
    private func formatDate(_ date: String) -> String {
        // Simple date formatting - could be enhanced
        String(date.prefix(10))
    }
}

// MARK: - Ticket Detail View
struct TicketDetailView: View {
    let ticket: Ticket
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(ticket.title)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    HStack(spacing: 12) {
                        StatusBadge(status: ticket.status)
                        PriorityBadge(priority: ticket.priority)
                    }
                }
                
                Divider()
                
                VStack(alignment: .leading, spacing: 12) {
                    InfoRow(label: "ID", value: ticket.id)
                    InfoRow(label: "Status", value: ticket.status)
                    InfoRow(label: "Priority", value: ticket.priority)
                    if let assignee = ticket.assignee {
                        InfoRow(label: "Assignee", value: assignee)
                    }
                    InfoRow(label: "Created", value: formatDateTime(ticket.createdAt))
                    InfoRow(label: "Updated", value: formatDateTime(ticket.updatedAt))
                }
                
                Divider()
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Description")
                        .font(.headline)
                    
                    Text(ticket.description)
                        .font(.body)
                        .foregroundColor(.gray)
                }
                
                Spacer()
            }
            .padding(16)
        }
        .navigationTitle("Ticket Details")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func formatDateTime(_ dateTimeString: String) -> String {
        // Simple formatting - could be enhanced
        String(dateTimeString.prefix(19))
    }
}

// MARK: - Settings View
struct SettingsView: View {
    let apiBase: String
    @ObservedObject var networkManager: NetworkManager
    @State private var showDisconnectAlert = false
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Connection")) {
                    HStack {
                        Text("API Base")
                        Spacer()
                        Text(apiBase)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    
                    HStack {
                        Text("Status")
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("Connected")
                                .font(.caption)
                        }
                    }
                }
                
                Section(header: Text("Security")) {
                    HStack {
                        Text("Token Storage")
                        Spacer()
                        Text("Keychain")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                
                Section {
                    Button(role: .destructive, action: { showDisconnectAlert = true }) {
                        HStack {
                            Image(systemName: "power")
                            Text("Disconnect")
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Disconnect?", isPresented: $showDisconnectAlert) {
                Button("Disconnect", role: .destructive) {
                    networkManager.disconnect()
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This will clear the connection to your ticket system.")
            }
        }
    }
}

// MARK: - Error View
struct ErrorView: View {
    let message: String
    let networkManager: NetworkManager
    @Binding var showScanner: Bool
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 48))
                    .foregroundColor(.red)
                
                Text("Connection Error")
                    .font(.headline)
                
                Text(message)
                    .font(.body)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            
            Spacer()
            
            VStack(spacing: 12) {
                Button(action: { showScanner = true }) {
                    HStack {
                        Image(systemName: "camera.viewfinder")
                        Text("Try Again")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                
                Button(action: { networkManager.disconnect() }) {
                    HStack {
                        Image(systemName: "arrow.counterclockwise")
                        Text("Reset Connection")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color(.systemGray4))
                    .foregroundColor(.black)
                    .cornerRadius(8)
                }
            }
            .padding(24)
        }
    }
}

// MARK: - Helper Components
struct StatusBadge: View {
    let status: String
    
    var statusColor: Color {
        switch status.lowercased() {
        case "open": return .blue
        case "in_progress": return .orange
        case "closed": return .green
        case "pending": return .yellow
        default: return .gray
        }
    }
    
    var body: some View {
        Text(status)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .cornerRadius(4)
    }
}

struct PriorityBadge: View {
    let priority: String
    
    var priorityColor: Color {
        switch priority.lowercased() {
        case "critical": return .red
        case "high": return .orange
        case "medium": return .yellow
        case "low": return .green
        default: return .gray
        }
    }
    
    var body: some View {
        Text(priority)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(priorityColor.opacity(0.2))
            .foregroundColor(priorityColor)
            .cornerRadius(3)
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Placeholder Modifier
extension View {
    func placeholder<Content: View>(when shouldShow: Bool, alignment: Alignment = .leading, @ViewBuilder placeholder: () -> Content) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

#Preview {
    ContentView()
}
