// Updated DriveCycleBuilder.tsx
"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, TrendingUp, Thermometer } from "lucide-react"
import { ManualDriveCycleBuilder } from "./manualDriveCycleBuilder" // Import the new component
import { DriveCyclePreview } from "./DriveCyclePreview"
import { useMemo } from "react"
interface NamedConfig {
  name: string
  config: any // Use 'any' for simplicity, or define Config type
}

interface DriveCycleBuilderProps {
  onConfigChange: (config: any) => void
  onNext: () => void
  onPrevious: () => void
}

export function DriveCycleBuilder() {
  const [configMethod, setConfigMethod] = useState("manual")
  const [error, setError] = useState("")
  const [startingSoc, setStartingSoc] = useState("80")
  const [manualConfig, setManualConfig] = useState<any>(null)
  const [predefinedConfig, setPredefinedConfig] = useState<any>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  

  const handleLoadConfig = (config: any) => {
    setPredefinedConfig(config)
    setConfigMethod("manual") // Switch to manual to show loaded data
    setError("")
  }


  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const file = e.target.files[0]
    setUploadedFile(file) // Clear predefined to make exclusive
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        try {
          const config = JSON.parse(event.target.result as string)
          handleLoadConfig(config)
        } catch (err) {
          setError("Invalid JSON file")
        }
      }
    }
    reader.readAsText(file)
  }

  const isValid = () => {
    const current = configMethod === "manual" ? manualConfig : predefinedConfig
    return !!current && current.subCycles?.length > 0 && current.driveCycles?.length > 0 && current.calendarRules?.length > 0 && current.defaultDriveCycleId && !!startingSoc
  }

  const handleSaveClick= () => {
    setError("")
    if (isValid()) {
      const config = configMethod === "manual" ? manualConfig : predefinedConfig
      const fullConfig = { ...config, startingSoc: Number.parseFloat(startingSoc) }
      console.log("Final Drive Cycle Config:", fullConfig)
      
    } else {
      setError("Please complete the configuration")
    }
  }

  const currentConfig = useMemo(() => {
  const baseConfig = configMethod === "manual" ? manualConfig : predefinedConfig
  if (!baseConfig) return null
  return {
    ...baseConfig,
    startingSoc: Number.parseFloat(startingSoc || "80"), // Default to 80 if empty
  }
}, [configMethod, manualConfig, predefinedConfig, startingSoc])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Drive Cycle Configuration
          </CardTitle>
          <CardDescription>Configure your drive cycle using predefined/upload or manual building.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={configMethod} onValueChange={setConfigMethod}>
            <TabsList className="grid w-full grid-cols-2">
              
              <TabsTrigger value="manual">Manual Builder</TabsTrigger>
              <TabsTrigger value="predefined-upload">Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="predefined-upload" className="mt-6">
              <div className="gap-8">
                <div className="space-y-4 p-4 border rounded-md">
                  <Label>Upload CSV File</Label>
                  <Input type="file" accept=".csv" onChange={handleUpload} />
                  <p className="text-sm text-muted-foreground">Upload your custom drive cycle CSV file.</p>
                  
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="text-sm font-medium mb-2">CSV File Format Instructions</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Column 1: Time (seconds)</li>
                      <li>Column 2: Current (A)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-6">
              <ManualDriveCycleBuilder 
                onConfigUpdate={setManualConfig}
                startingSoc={startingSoc}
                loadedConfig={predefinedConfig}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Add DriveCyclePreview component */}
      {currentConfig && isValid() && (
        <DriveCyclePreview
          config={currentConfig}
          nominalV={3.7} // Adjust as needed
          capacity={5.0} // Adjust as needed
        />
      )}
      

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      
      <div className="flex justify-end">
        <Button onClick={handleSaveClick} disabled={!isValid()} className="min-w-32">
          Save Drive Cycle Configuration
        </Button>
      </div>
    </div>
  )
}