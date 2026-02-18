import Foundation
import AVFoundation
import UIKit

// MARK: - QR Code Scanner ViewController
class QRCodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?
    var onScanned: ((String) -> Void)?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupCamera()
    }
    
    private func setupCamera() {
        captureSession = AVCaptureSession()
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            showError("Camera not available")
            return
        }
        
        let videoInput: AVCaptureDeviceInput
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            showError("Cannot access camera")
            return
        }
        
        guard let session = captureSession, session.canAddInput(videoInput) else {
            showError("Cannot add camera input")
            return
        }
        
        session.addInput(videoInput)
        
        let metadataOutput = AVCaptureMetadataOutput()
        guard session.canAddOutput(metadataOutput) else {
            showError("Cannot add metadata output")
            return
        }
        
        session.addOutput(metadataOutput)
        metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        metadataOutput.metadataObjectTypes = [.qr]
        
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer?.frame = view.layer.bounds
        previewLayer?.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer!)
        
        session.startRunning()
    }
    
    func metadataOutput(_ output: AVCaptureMetadataOutput,
                       didOutput metadataObjects: [AVMetadataObject],
                       from connection: AVCaptureConnection) {
        captureSession?.stopRunning()
        
        if let metadataObject = metadataObjects.first,
           let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
           let stringValue = readableObject.stringValue {
            onScanned?(stringValue)
        }
    }
    
    private func showError(_ message: String) {
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - SwiftUI Wrapper
import SwiftUI

struct QRCodeScanner: UIViewControllerRepresentable {
    @Environment(\.presentationMode) var presentationMode
    var onScanned: (String) -> Void
    
    func makeUIViewController(context: Context) -> QRCodeScannerViewController {
        let scanner = QRCodeScannerViewController()
        scanner.onScanned = { result in
            onScanned(result)
            presentationMode.wrappedValue.dismiss()
        }
        return scanner
    }
    
    func updateUIViewController(_ uiViewController: QRCodeScannerViewController, context: Context) {
        // No updates needed
    }
}
