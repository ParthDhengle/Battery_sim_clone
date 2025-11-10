import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Battery } from "lucide-react"
import UnderDevelopment from "@/components/Underdev"
export default function Library() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Library</h1>
        
        <div className="space-x-2">
          <Link href="/library/cells">
            <Button>Manage Cells</Button>
          </Link>
          <Link href="/library/packs">  {/* New */}
            <Button>Manage Packs</Button>
          </Link>
          <Link href="/library/drive-cycles">  {/* Updated to list page */}
            <Button variant="outline">Manage Drive Cycles</Button>
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-5 h-5" />
            Reusable Components
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Browse and edit saved battery cells, packs, and drive cycles.</p>
        </CardContent>
      </Card>
    </div>
  )
}