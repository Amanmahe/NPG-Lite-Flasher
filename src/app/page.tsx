"use client"
import { useEffect, useState } from 'react';
import { core } from "@tauri-apps/api";
import { AlertCircle, CheckCircle, Cpu, Wifi, Bluetooth, Usb, ArrowRight, RefreshCw, X, Plus, Upload, Trash2, Download, Github } from "lucide-react";
type FirmwareFile = [string, string]; // [name, url]
import Link from "next/link";
import { open } from '@tauri-apps/plugin-shell';

export default function Home() {
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [output, setOutput] = useState('');
  const [firmwareType, setFirmwareType] = useState('');
  const [showPopover, setShowPopover] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashStatus, setFlashStatus] = useState(''); // 'success', 'error', or ''
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customFirmwares, setCustomFirmwares] = useState<string[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newFirmwareName, setNewFirmwareName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showGithubDialog, setShowGithubDialog] = useState(false);
  const [githubFirmwares, setGithubFirmwares] = useState<FirmwareFile[]>([]);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const githubRepo = "upsidedownlabs/npg-lite-firmware";
  const [downloadingFirmware, setDownloadingFirmware] = useState<string | null>(null);
  const [downloadedFirmwares, setDownloadedFirmwares] = useState<string[]>([]);
  const [flashFromUpload, setFlashFromUpload] = useState(false);
  const [isFirmwareExists, setIsFirmwareExists] = useState(false);
  const [isFlashed, setIsFlashed] = useState(false);
  // Poll for serial ports at regular intervals
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refreshPorts();
    }, 3000); // Poll every 3 seconds

    // Initial load
    refreshPorts();
    loadCustomFirmwares();

    return () => clearInterval(pollInterval); // Cleanup on unmount
  }, []);

  const refreshPorts = async () => {
    setIsRefreshing(true);
    try {
      core.invoke<string[]>("list_serial_ports").then(setPorts);
    } catch (err) {
      console.error("Error listing ports:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadCustomFirmwares = async () => {
    try {
      const firmwares = await core.invoke<string[]>("list_custom_firmwares");
      setCustomFirmwares(firmwares);
      setDownloadedFirmwares(prev => prev.filter(fw => firmwares.includes(fw)));
    } catch (err) {
      console.error("Error loading custom firmwares:", err);
    }
  };

  const fetchGithubReleases = async () => {
    setIsFetchingGithub(true);
    try {
      const releases = await core.invoke<FirmwareFile[]>("fetch_github_releases", {
        repo: githubRepo
      });
      setGithubFirmwares(releases);
      setShowGithubDialog(true);
    } catch (err) {
      console.error("Error fetching GitHub releases:", err);
      setOutput(`Error fetching releases: ${String(err)}`);
      setFlashStatus('error');
    } finally {
      setIsFetchingGithub(false);
    }
  };
  useEffect(() => {
    if (newFirmwareName) {
      const exists = customFirmwares.some(fw =>
        fw.toLowerCase() === `${newFirmwareName}.bin`.toLowerCase()
      );
      setIsFirmwareExists(exists);
    } else {
      setIsFirmwareExists(false);
    }
  }, [newFirmwareName, customFirmwares]);
  const handleGithubFirmwareSelect = async (url: string, name: string) => {
    try {
      setDownloadingFirmware(name);
      setOutput(`Downloading ${name}...`);

      const downloadedName = await core.invoke<string>("download_and_save_firmware", {
        url,
        name
      });

      await loadCustomFirmwares();
      setDownloadedFirmwares(prev => [...prev, name]);
      setShowGithubDialog(false);
      handleFirmwareTypeChange(downloadedName);
      setOutput(`Successfully downloaded ${name}`);
    } catch (err) {
      console.error("Error downloading firmware:", err);
      setOutput(`Error downloading firmware: ${String(err)}`);
      setFlashStatus('error');
    } finally {
      setDownloadingFirmware(null);
    }
  };

  const handleFirmwareTypeChange = (type: string) => {
    setFirmwareType(type);
    setIsFlashed(false);
    if (type) {
      setShowPopover(true);
      setFlashStatus('');
      setOutput('');
    }
  };

  const handleFlash = async (customFirmwareName?: string) => {
    const firmwareToFlash = customFirmwareName || firmwareType;
    console.log(firmwareToFlash);
    if (!selectedPort) {
      setOutput("Error: Please select a port first.");
      setFlashStatus('error');
      return;
    }

    let file = "";
    let isCustom = false;

    switch (firmwareToFlash) {
      case "BLE":
        file = "/NPG-LITE-BLE.ino.bin";
        break;
      case "Serial":
        file = "/NPG-LITE.ino.bin";
        break;
      case "WiFi":
        file = "/NPG-LITE-WiFi.ino.bin";
        break;
      default:
        file = firmwareToFlash;
        isCustom = true;
    }

    setIsFlashing(true);
    setOutput("Flashing firmware, please wait...");
    setFlashStatus('');

    try {
      const result = await core.invoke("flash_firmware", {
        portname: selectedPort,
        file: file,
        iscustom: isCustom
      });
      setOutput(`Success: ${String(result)}`);
      setFlashStatus('success');
      setIsFlashed(true);
    } catch (err) {
      console.error("Flash failed:", err);
      setOutput(`Error: ${String(err)}`);
      setFlashStatus('error');
      setIsFlashed(false);
    } finally {
      setIsFlashing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !newFirmwareName) {
      alert("Please select a file and enter a name");
      return;
    }
    const arrayBuffer = await selectedFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    setIsUploading(true);
    try {
      const firmwareName = await core.invoke<string>("save_custom_firmware", {
        name: newFirmwareName,
        data: Array.from(bytes)
      });

      await loadCustomFirmwares();
      return firmwareName; // Return the firmware name
    } catch (err) {
      console.error("Upload failed:", err);
      alert(`Failed to upload firmware: ${err}`);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      // Set the default name to the filename without .bin extension
      const fileName = file.name.replace(/\.bin$/i, '');
      setNewFirmwareName(fileName);
    }
  };

  const handleDeleteFirmware = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }

    try {
      await core.invoke<void>("delete_custom_firmware", { filename });
      await loadCustomFirmwares();
      setDownloadedFirmwares(prev => prev.filter(fw => fw !== filename));
    } catch (err) {
      console.error("Error deleting firmware:", err);
      alert(`Failed to delete firmware: ${err}`);
    }
  };

  const closePopover = () => {
    setShowPopover(false);
    setFirmwareType('');
    setOutput('');
    setFlashStatus('');
  };

  const getFirmwareIcon = (type: string) => {
    switch (type) {
      case "BLE":
        return <Bluetooth className="mr-2" />;
      case "Serial":
        return <Usb className="mr-2" />;
      case "WiFi":
        return <Wifi className="mr-2" />;
      default:
        return <Cpu className="mr-2" />;
    }
  };

  const handleClick = async (url: string) => {
    await open(url);
  };

  const getStatusColor = () => {
    if (flashStatus === 'success') return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
    if (flashStatus === 'error') return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
  };

  const getStatusIcon = () => {
    if (flashStatus === 'success') return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />;
    if (flashStatus === 'error') return <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
    if (downloadingFirmware) return <RefreshCw className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-3">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Neuro PlayGround (NPG) Lite Firmware Flasher</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Select a firmware type to begin flashing your device</p>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 ">
          <div className="flex justify-between items-center mb-4">
            <h2 className="flex items-center text-2xl font-semibold text-gray-900 dark:text-white gap-2">
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <div className="font-rancho font-bold text-2xl duration-300 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent bg-clip-text">
                  Chords
                </div>
              </Link>Firmware </h2>
            <div className="flex gap-2">
              <button
                onClick={fetchGithubReleases}
                disabled={isFetchingGithub}
                className="flex items-center cursor-pointer gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
              >
                {isFetchingGithub ? (
                  <RefreshCw className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    <Github className="h-4 w-4" /> Get from GitHub
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowUploadDialog(true);
                  setFlashFromUpload(false);
                  setOutput("");
                  setNewFirmwareName("");
                  setSelectedFile(null);
                }}
                className="flex items-center cursor-pointer gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
              >
                <Plus size={16} /> Add Custom Firmware
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { type: "BLE", title: "Bluetooth LE", description: "For wireless Bluetooth LE connectivity" },
              { type: "Serial", title: "Serial", description: "For direct wired USB serial connections " },
              { type: "WiFi", title: "WiFi", description: "For wireless WiFi network connectivity" }
            ].map((option) => (
              <div
                key={option.type}
                onClick={() => handleFirmwareTypeChange(option.type)}
                className="group relative p-[2px] rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-300 "
              >
                <div
                  className={`relative rounded-lg p-4 cursor-pointer transition-all duration-200 border ${firmwareType === option.type
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-400/30 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                >
                  <div className="flex items-center text-gray-900 dark:text-white">
                    {getFirmwareIcon(option.type)}
                    <span className="font-medium">{option.title}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">{option.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className='flex w-full items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mt-4 '>
            <span className="text-gray-900 dark:text-white text-sm pl-2">Visualise your bio-potential signals on</span>

            <button
              onClick={() => handleClick("https://chords.upsidedownlabs.tech/npg-lite")}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors cursor-pointer "
            >
              Chords-Web (recommended)
            </button>

            <button
              onClick={() => handleClick("https://github.com/upsidedownlabs/Chords-Python")}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors cursor-pointer"
            >
              Chords-Python
            </button>
          </div>

          {customFirmwares.length > 0 ? (
            <>
              <div className="border-t border-gray-300 dark:border-gray-600 my-4"></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Custom Firmwares</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {customFirmwares.map((fw) => (
                  <div
                    key={fw}
                    className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${firmwareType === fw
                      ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-400/30 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <div
                        className="flex items-center w-full text-gray-900 dark:text-white"
                        onClick={() => handleFirmwareTypeChange(fw)}
                      >
                        <Cpu className="mr-2" />
                        <span className="font-medium">{fw.slice(0, -4)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFirmware(fw);
                          setIsFlashed(false);
                        }}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 transition-colors"
                        title="Delete firmware"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Custom firmware</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 mt-4">Custom Firmwares</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <p className="text-white text-sm font-medium">
                      No custom firmwares added, once added, your custom firmwares will appear here for flashing.
                    </p>
                  </div>
                </div>

                <div className="space-x-6 flex">
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-200 font-semibold text-sm">1</span>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                          NPG Lite Firmwares from GitHub
                        </h5>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Click on <span className="font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"> <a
                            rel="noopener noreferrer"
                            onClick={fetchGithubReleases}
                          >
                            <Github className="h-4 w-4 inline" /> Get from GitHub
                          </a></span> button.
                          A popover will show with a list of available firmwares. You can download any firmware from the list,
                          and it will be automatically added to your custom firmwares.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-semibold text-sm">2</span>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                          Upload Your Custom ESP32 Binary
                        </h5>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Click on <span className="font-semibold text-green-600 dark:text-green-400 cursor-pointer"><a
                            rel="noopener noreferrer"
                            onClick={() => setShowUploadDialog(true)}
                          >
                            <Plus size={16} className="inline" /> Add Custom
                          </a></span> button.
                          A popover will appear where you can upload your binary file from your system.
                          Give it a custom name and click<span className="font-semibold text-green-600 dark:text-green-400">&quot;Upload Firmware&quot;</span>
                          to add it.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {showUploadDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {flashFromUpload ? "Flash Custom Firmware" : "Upload Custom Firmware"}
                </h2>
                <button
                  onClick={() => {
                    setShowUploadDialog(false);
                    setOutput("");
                    setFlashFromUpload(false);
                    setIsFlashed(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  disabled={isUploading || isFlashing}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 text-gray-900 dark:text-white">
                {!flashFromUpload ? (
                  // Step 1: Upload form
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Firmware File (.bin)
                      </label>
                      <div className="flex items-center">
                        <label className={`flex items-center px-4 py-2 border rounded-md cursor-pointer transition-colors ${isUploading
                          ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                          }`}>
                          <Upload className="h-5 w-5 mr-2" />
                          {selectedFile ? selectedFile.name : "Choose File"}
                          <input
                            type="file"
                            accept=".bin"
                            onChange={(e) => !isUploading && handleFileChange(e.target.files?.[0] || null)}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Firmware Name
                      </label>
                      <input
                        type="text"
                        value={newFirmwareName}
                        onChange={(e) => setNewFirmwareName(e.target.value)}
                        placeholder="e.g., MyCustomFirmware"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        disabled={isUploading}
                      />
                    </div>
                    {isFirmwareExists && (
                      <div className="my-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center space-x-2">
                          <p className="pl-2 text-red-800 dark:text-red-200 text-sm">
                            A firmware with this name already exists. Adding it again will overwrite the existing firmware.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Step 2: Flash options
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Selected Firmware
                      </label>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center">
                          <Cpu className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400" />
                          <span className="font-medium">{newFirmwareName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Serial Port
                      </label>
                      <div className="flex">
                        <select
                          onChange={e => {
                            setSelectedPort(e.target.value);
                            setIsFlashed(false);
                          }}
                          value={selectedPort}
                          className="flex-grow border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-black-900 dark:text-black"
                          disabled={isFlashing}
                        >
                          <option value="">-- Select Port --</option>
                          {ports.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button
                          onClick={refreshPorts}
                          className="bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md px-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          disabled={isFlashing || isRefreshing}
                        >
                          <RefreshCw className={`h-5 w-5 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {output && (
                  <div className={`border rounded-md p-3 mt-4 ${getStatusColor()} transition-colors duration-200`}>
                    <div className="flex items-start gap-2">
                      {getStatusIcon()}
                      <pre className="text-sm whitespace-pre-wrap font-mono flex-1 overflow-x-auto">
                        {output}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  {!flashFromUpload ? (
                    // Step 1 buttons
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowUploadDialog(false);
                          setOutput("");
                        }}
                        className="px-4 py-2 border cursor-pointer border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        disabled={isUploading}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await handleFileUpload();
                            setFlashFromUpload(true);
                          } catch (err) {
                            console.warn(err);
                          }
                        }}
                        disabled={isUploading || !selectedFile || !newFirmwareName}
                        className={`px-4 py-2 rounded-md flex items-center transition-colors ${!selectedFile || !newFirmwareName
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                          } text-white`}
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                            Adding...
                          </>
                        ) : (
                          'Add & Continue to Flash'
                        )}
                      </button>
                    </div>
                  ) : (
                    // Step 2 buttons
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowUploadDialog(false);
                          setOutput("");
                        }}
                        className="px-4 py-2 border cursor-pointer border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        disabled={isUploading}
                      >
                        Exit
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await handleFlash(`${newFirmwareName}.bin`);
                          } catch (err) {
                            console.warn(err);
                          }
                        }}
                        disabled={isFlashing || isFlashed || !selectedPort}
                        className={`px-4 py-2 rounded-md flex items-center transition-colors ${
                          !selectedPort || isFlashing
                            ? 'bg-gray-400 cursor-not-allowed'
                            : isFlashed
                            ? 'bg-green-600 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                        } text-white`}
                      >
                        {isFlashing ? (
                          <>
                            <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                            Flashing...
                          </>
                        ) : isFlashed ? (
                          'Flashed'
                        ) : (
                          'Flash Firmware'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Other dialogs (showPopover, showGithubDialog) remain the same */}
        {showPopover && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                <div className="flex text-gray-900 dark:text-white items-center">
                  {getFirmwareIcon(firmwareType)}
                  <h2 className="text-xl font-semibold">
                    Flash {["BLE", "Serial", "WiFi"].includes(firmwareType) ? firmwareType : "Custom"} Firmware
                  </h2>
                </div>
                <button
                  onClick={closePopover}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 text-gray-900 dark:text-white">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Serial Port
                  </label>
                  <div className="flex">
                    <select
                      onChange={e => {
                        setSelectedPort(e.target.value);
                        setIsFlashed(false);
                      }} value={selectedPort}
                      className="flex-grow border border-gray-300 dark:border-gray-600 rounded-l-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-black-900 dark:text-black"
                      disabled={isFlashing}
                    >
                      <option value="">-- Select Port --</option>
                      {ports.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      onClick={refreshPorts}
                      className="bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md px-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      disabled={isFlashing || isRefreshing}
                    >
                      <RefreshCw className={`h-5 w-5 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {output && (
                  <div className={`border rounded-md p-3 mt-4 ${getStatusColor()} transition-colors duration-200`}>
                    <div className="flex items-start gap-2">
                      {getStatusIcon()}
                      <pre className="text-sm whitespace-pre-wrap font-mono flex-1 overflow-x-auto">
                        {output}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={closePopover}
                    className="px-4 py-2 border cursor-pointer border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={isFlashing}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await handleFlash();
                        // Only close if successful (handleFileUpload will throw on error)
                        setShowUploadDialog(false);
                      } catch (err) {
                        console.warn(err);
                      }
                    }}
                    disabled={isFlashing ||isFlashed}
                    className={`px-4 py-2 rounded-md flex items-center transition-colors ${
                      !selectedPort || isFlashing
                        ? 'bg-gray-400 cursor-not-allowed'
                        : isFlashed
                        ? 'bg-green-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                    } text-white`}
                  >
                    {isFlashing ? (
                      <>
                        <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                        Flashing...
                      </>
                    ) : isFlashed ? (
                      'Flashed'
                    ) : (
                      'Flash Firmware'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGithubDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
              <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Firmware from GitHub</h2>
                </div>
                <button
                  onClick={() => {
                    setShowGithubDialog(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 text-gray-900 dark:text-white overflow-y-auto flex-1 min-h-0">
                {githubFirmwares.length === 0 ? (
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">No firmware files found in the latest release.</p>
                    <button
                      onClick={fetchGithubReleases}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-md text-sm mx-auto transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {githubFirmwares.map((fws, index) => {
                      const [name, url] = fws;
                      const isDownloading = downloadingFirmware === name;
                      const isDownloaded = downloadedFirmwares.includes(name) && customFirmwares.includes(name);

                      return (
                        <div
                          key={index}
                          className={`border border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center transition-colors ${isDownloading ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            } ${isDownloaded ? 'border-green-300 dark:border-green-700' : ''
                            }`}
                          onClick={() => !isDownloading && !isDownloaded && handleGithubFirmwareSelect(url, name)}
                        >
                          <div className="flex items-center">
                            {isDownloading ? (
                              <RefreshCw className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400 animate-spin" />
                            ) : isDownloaded ? (
                              <CheckCircle className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                            ) : (
                              <Download className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                            )}
                            <span className="text-gray-900 dark:text-white truncate">{name || 'Default Name'}</span>
                          </div>
                          {isDownloading ? (
                            <span className="text-sm text-blue-600 dark:text-blue-400">Downloading...</span>
                          ) : isDownloaded ? (
                            <span className="text-sm text-green-600 dark:text-green-400">Downloaded</span>
                          ) : (
                            <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}