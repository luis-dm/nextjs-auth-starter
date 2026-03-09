"use client";

import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import * as WEBIFC from "web-ifc";
import * as FRAGS from "@thatopen/fragments";
import toast from "react-hot-toast";
import {
  buildTypePropertyIndex,
  TypePropertyIndex,
} from "@/utils/ifcTypeIndex";

interface ConversionResult {
  fragmentBytes: ArrayBuffer;
  conversionTimeMs: number;
  fileSizeInMB: number;
  modelID: number;
}

let webIfc: WEBIFC.IfcAPI | null = null;
let serializer: FRAGS.IfcImporter | null = null;
let currentModelID: number | null = null;

// Initialize WebIFC and serializer
const initWebIfc = async (): Promise<void> => {
  webIfc = new WEBIFC.IfcAPI();
  webIfc.SetWasmPath("https://unpkg.com/web-ifc@0.0.75/", true);
  await webIfc.Init();

  serializer = new FRAGS.IfcImporter();
  serializer.wasm = {
    absolute: true,
    path: "https://unpkg.com/web-ifc@0.0.75/",
  };
};

// Function to simulate progress for visual feedback
const simulateProgress = (
  updateCallback: (progress: number) => void,
): number => {
  let progress = 0;
  let lastProgressReported = -1;

  return setInterval(() => {
    if (progress < 95) {
      const increment = progress < 30 ? 1 : progress < 70 ? 2 : 0.5;
      progress += increment;
      progress = Math.min(progress, 95);

      const roundedProgress = Math.round(progress);
      if (roundedProgress !== lastProgressReported) {
        lastProgressReported = roundedProgress;
        try {
          updateCallback(roundedProgress);
        } catch (error) {
          console.warn("Error in progress callback:", error);
        }
      }
    }
  }, 500) as unknown as number;
};

// Convert IFC file to fragments
const convertIFC = async (
  file: File,
  callbacks: {
    onProgress?: (progress: number) => void;
    onFinish?: () => void;
  } = {},
): Promise<ConversionResult | null> => {
  if (!webIfc || !serializer) {
    await initWebIfc();
  }

  if (!webIfc || !serializer) {
    throw new Error("Failed to initialize WebIFC");
  }

  let progressInterval: number | null = null;
  if (callbacks.onProgress) {
    progressInterval = simulateProgress((progress) => {
      if (callbacks.onProgress) {
        callbacks.onProgress(progress);
      }
    });
  }

  console.log("Starting IFC conversion process...");
  const startTime = performance.now();

  try {
    const ifcBuffer = await file.arrayBuffer();
    const fileSizeInMB = Math.round((file.size / (1024 * 1024)) * 100) / 100;
    console.log(`📁 File: ${file.name} (${fileSizeInMB} MB)`);

    console.log("Processing IFC file...");
    const ifcBytes = new Uint8Array(ifcBuffer);

    // Load the model in web-ifc
    try {
      if (currentModelID !== null) {
        try {
          webIfc.CloseModel(currentModelID);
        } catch (e) {
          console.warn("Failed to close previous model:", e);
        }
      }

      currentModelID = webIfc.OpenModel(ifcBytes);
      console.log(`IFC model loaded with ID: ${currentModelID}`);
    } catch (e) {
      console.error("Error loading IFC model into web-ifc:", e);
      throw e;
    }

    // Convert the IFC bytes to fragments
    const processInput = { bytes: ifcBytes };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await serializer.process(processInput as any);
    const fragmentBytes =
      result instanceof Uint8Array
        ? (result.buffer as ArrayBuffer)
        : (result as ArrayBuffer);

    const endTime = performance.now();
    const conversionTimeMs = Math.round(endTime - startTime);

    console.log(`Conversion complete in ${conversionTimeMs / 1000} seconds`);
    console.log(
      `📊 Conversion rate: ${
        Math.round((fileSizeInMB / (conversionTimeMs / 1000)) * 100) / 100
      } MB/s`,
    );

    return {
      fragmentBytes,
      conversionTimeMs,
      fileSizeInMB,
      modelID: currentModelID,
    };
  } catch (error) {
    console.error("Error converting IFC:", error);
    return null;
  } finally {
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    if (callbacks.onProgress) {
      try {
        callbacks.onProgress(100);
      } catch (error) {
        console.warn("Error in final progress callback:", error);
      }
    }

    if (callbacks.onFinish) {
      callbacks.onFinish();
    }
  }
};

interface RegisterFacilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    name: string,
    fragmentData: ArrayBuffer | null,
    ifcFileName: string | null,
    ifcFileSize: number | null,
    typePropertyIndex: TypePropertyIndex | null,
  ) => Promise<void>;
  isUploading?: boolean;
}

export default function RegisterFacilityModal({
  isOpen,
  onClose,
  onSubmit,
  isUploading = false,
}: RegisterFacilityModalProps) {
  const [facilityName, setFacilityName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isUploadingInternal, setIsUploadingInternal] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (facilityName.trim()) {
      let fragmentData: ArrayBuffer | null = null;
      let ifcFileName: string | null = null;
      let ifcFileSize: number | null = null;
      let typePropertyIndex: TypePropertyIndex | null = null;

      // Convert IFC to fragments and build type index if file is selected
      if (selectedFile) {
        setIsConverting(true);

        try {
          // Read IFC file as text for building the type index
          const ifcText = await selectedFile.text();
          console.log("Building type property index...");
          typePropertyIndex = buildTypePropertyIndex(ifcText);
          console.log("Type property index built successfully");

          // Convert IFC to fragments
          const result = await convertIFC(selectedFile, {
            onProgress: (progress) => {
              setConversionProgress(progress);
            },
            onFinish: () => {
              console.log("Conversion finished");
            },
          });

          if (result) {
            fragmentData = result.fragmentBytes;
            ifcFileName = selectedFile.name;
            ifcFileSize = selectedFile.size;
            console.log(
              `Converted ${selectedFile.name} to fragments (${(result.fragmentBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`,
            );
          } else {
            toast.error("Failed to convert IFC file");
            setIsConverting(false);
            return;
          }
        } catch (error) {
          console.error("Error converting IFC:", error);
          toast.error("Error converting IFC file");
          setIsConverting(false);
          return;
        }
        // Don't set isConverting to false here - transition to upload state
        setConversionProgress(0);
      }

      // Show upload state
      setIsConverting(false);
      setIsUploadingInternal(true);

      // Wait for upload to complete
      await onSubmit(
        facilityName.trim(),
        fragmentData,
        ifcFileName,
        ifcFileSize,
        typePropertyIndex,
      );

      // Reset form after successful upload
      setFacilityName("");
      setSelectedFile(null);
      setIsUploadingInternal(false);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".ifc")) {
      setSelectedFile(file);
    } else if (file) {
      toast.error("Please select a valid IFC file");
      e.target.value = "";
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        {/* Conversion/Upload Loading Overlay */}
        {(isConverting || isUploadingInternal) && (
          <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center z-10">
            <div className="w-16 h-16 border-4 border-gray-800 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium mb-2">
              {isConverting
                ? "Converting IFC to Fragments..."
                : "Uploading facility..."}
            </p>
            {isConverting && (
              <p className="text-sm text-gray-600">{conversionProgress}%</p>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Register New Facility
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Facility Name Input */}
          <div className="mb-4">
            <label
              htmlFor="facilityName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Facility Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="facilityName"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              placeholder="Enter facility name"
              required
            />
          </div>

          {/* IFC File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IFC File <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc"
                onChange={handleFileChange}
                className="hidden"
                required
              />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              {selectedFile ? (
                <div>
                  <p className="text-sm text-gray-700 font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 mt-2"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">
                    Click to upload IFC file
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Required</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting || isUploadingInternal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !facilityName.trim() ||
                !selectedFile ||
                isConverting ||
                isUploadingInternal
              }
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isConverting
                ? "Converting..."
                : isUploadingInternal
                  ? "Uploading..."
                  : "Upload Model"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
