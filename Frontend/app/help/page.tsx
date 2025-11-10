import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle, BookOpen, Mail } from "lucide-react"

export default function Help() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="text-muted-foreground">Get help with using the Battery Simulation Tool</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Learn the basics of the simulation tool</p>
            <ul className="space-y-1 text-sm">
              <li>• Creating your first project</li>
              <li>• Building a battery pack</li>
              <li>• Defining drive cycles</li>
              <li>• Running simulations</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Frequently asked questions</p>
            <ul className="space-y-1 text-sm">
              <li>• How do I export results?</li>
              <li>• What formats are supported?</li>
              <li>• How long do simulations take?</li>
              <li>• Can I import custom data?</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Need help? Contact our support team</p>
            <p className="text-sm">Email: support@ycs-tech.com</p>
            <p className="text-sm">Version: 1.0.0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
