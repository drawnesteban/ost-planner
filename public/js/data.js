// Placeholder data for the landing page. Replaced by real storage in a later step.

export const views = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "projects", label: "Projects", icon: "folder", step: "Client and project goals" },
  { id: "personal", label: "Personal works", icon: "brush", step: "Your own creative work" },
  { id: "tasks", label: "Tasks", icon: "list", step: "Board and list views of tasks" },
  { id: "todo", label: "To-do", icon: "check", step: "Daily to-do lists" },
  { id: "timeline", label: "Timeline", icon: "timeline", step: "Gantt-style project timelines" },
  { id: "contacts", label: "Contacts", icon: "user", step: "Client contact cards" },
  { id: "gallery", label: "Progress gallery", icon: "image", step: "Images, drawings and renders" },
];

// image: placeholder covers in img/projects/ until uploads exist.
export const projects = [
  { id: 1, name: "Harbor Street Mural", client: "City Arts Council", type: "client", color: "#E8833A", progress: 62, due: "2026-11-14", open: 7, active: true, image: "img/projects/harbor-mural.svg" },
  { id: 2, name: "Brand refresh", client: "Delgado Coffee", type: "client", color: "#4C6EF5", progress: 35, due: "2026-12-02", open: 12, active: true, image: "img/projects/delgado-brand.svg" },
  { id: 3, name: "Ceramics series", client: "Personal", type: "personal", color: "#2F9E77", progress: 80, due: "2026-10-31", open: 3, active: true, image: "img/projects/ceramics.svg" },
  { id: 4, name: "Graphic novel draft", client: "Personal", type: "personal", color: "#AE3EC9", progress: 18, due: "2027-03-01", open: 9, active: true, image: "img/projects/graphic-novel.svg" },
  { id: 5, name: "Lobby installation", client: "Northside Clinic", type: "client", color: "#E0A100", progress: 48, due: "2026-11-28", open: 5, active: true, image: "img/projects/lobby-install.svg" },
  { id: 6, name: "Risograph zine", client: "Personal", type: "personal", color: "#D6453D", progress: 40, due: "2027-01-15", open: 6, active: false, image: "img/projects/zine.svg" },
  { id: 7, name: "Faculty portrait series", client: "Westbrook College", type: "client", color: "#5C7080", progress: 100, due: "2026-09-12", open: 0, active: false, image: "img/projects/portrait-series.svg" },
  { id: 8, name: "Gallery wayfinding signs", client: "Eastside Gallery", type: "client", color: "#1098AD", progress: 100, due: "2026-08-30", open: 0, active: false, image: "img/projects/gallery-signage.svg" },
];

export const todos = [
  { text: "Send mural color proofs to council", project: 1, done: false, time: "10:00" },
  { text: "Grade ARTS 210 midterm critiques", project: null, done: false, time: "13:00" },
  { text: "Glaze firing batch 3", project: 3, done: true, time: "" },
  { text: "Logo sketches round 2", project: 2, done: false, time: "16:00" },
  { text: "Call Dr. Osei about install date", project: 5, done: false, time: "" },
];

export const milestones = [
  { title: "Glaze test results", project: 3, date: "2026-10-20" },
  { title: "Mural final sketch approval", project: 1, date: "2026-10-24" },
  { title: "Logo presentation", project: 2, date: "2026-10-29" },
  { title: "Install site survey", project: 5, date: "2026-11-03" },
  { title: "Chapter 1 thumbnails", project: 4, date: "2026-11-10" },
];

export const contacts = [
  { id: 1, name: "Maya Thompson", org: "City Arts Council", role: "Program director", phone: "555-201-3344", email: "maya@cityarts.org", notes: "Prefers email. Approves mural sketches with the council board.", color: "#E8833A" },
  { id: 2, name: "Andrés Delgado", org: "Delgado Coffee", role: "Owner", phone: "555-873-1902", email: "andres@delgadocoffee.com", notes: "", color: "#4C6EF5" },
  { id: 3, name: "Dr. Kwame Osei", org: "Northside Clinic", role: "Facilities lead", phone: "555-440-7781", email: "k.osei@northsideclinic.org", notes: "Install access is weekdays after 6pm.", color: "#E0A100" },
  { id: 4, name: "Priya Nair", org: "Fabricator", role: "Metal shop", phone: "555-617-2230", email: "priya@nairfab.com", notes: "Vendor, not a client.", color: "#2F9E77" },
  { id: 5, name: "Helen Park", org: "Westbrook College", role: "Communications office", phone: "555-302-1185", email: "hpark@westbrook.edu", notes: "", color: "#5C7080" },
  { id: 6, name: "Tomás Rivera", org: "Eastside Gallery", role: "Gallery manager", phone: "555-764-0093", email: "tomas@eastsidegallery.com", notes: "", color: "#1098AD" },
];

export const uploads = [
  { title: "Mural sketch v3", project: 1, kind: "Drawing", date: "2026-10-16" },
  { title: "Vase glaze test", project: 3, kind: "Photo", date: "2026-10-15" },
  { title: "Logo concepts", project: 2, kind: "Drawing", date: "2026-10-14" },
  { title: "Lobby render", project: 5, kind: "Render", date: "2026-10-12" },
];

// Placeholder content for each project's detail page (#project/<id>).
export const projectDetails = {
  1: {
    created: "2026-07-06",
    description: "A 60-foot mural on the Harbor Street underpass about the neighborhood's fishing history, painted with two student assistants.",
    invoice: "harbor-mural-deposit.pdf",
    amount: 18500,
    tasks: [
      { name: "Final sketch to council", due: "2026-10-24", status: "In progress", priority: "High" },
      { name: "Order exterior paint", due: "2026-10-28", status: "In progress", priority: "Medium" },
      { name: "Wall prep and primer", due: "2026-11-02", status: "In progress", priority: "Medium" },
      { name: "Color proofs", due: "2026-10-12", status: "Done", priority: "Low" },
    ],
    todos: [
      { text: "Send color proofs to Maya", column: "In progress" },
      { text: "Book scissor lift", column: "In progress" },
      { text: "Permit for street closure", column: "On hold" },
      { text: "Site photos", column: "Done" },
      { text: "Measure wall", column: "Done" },
    ],
    gallery: [
      { title: "Sketch v3", kind: "Drawing", date: "2026-10-16" },
      { title: "Color study", kind: "Drawing", date: "2026-10-09" },
      { title: "Wall before", kind: "Photo", date: "2026-09-30" },
      { title: "Mockup on site", kind: "Render", date: "2026-09-22" },
      { title: "Sketch v2", kind: "Drawing", date: "2026-09-15" },
      { title: "Reference board", kind: "Photo", date: "2026-09-02" },
    ],
  },
  2: {
    created: "2026-08-18",
    description: "New logo, menu boards and cup sleeves for Delgado Coffee's second location.",
    invoice: "",
    amount: 6200,
    tasks: [
      { name: "Logo sketches round 2", due: "2026-10-22", status: "In progress", priority: "High" },
      { name: "Menu board layout", due: "2026-11-10", status: "In progress", priority: "Medium" },
      { name: "Brand interview notes", due: "2026-09-10", status: "Done", priority: "Low" },
    ],
    todos: [
      { text: "Pick 3 logo directions", column: "In progress" },
      { text: "Cup sleeve printer quote", column: "On hold" },
      { text: "Mood board", column: "Done" },
    ],
    gallery: [
      { title: "Logo concepts", kind: "Drawing", date: "2026-10-14" },
      { title: "Mood board", kind: "Photo", date: "2026-09-12" },
      { title: "Type tests", kind: "Drawing", date: "2026-09-20" },
    ],
  },
  3: {
    created: "2026-06-01",
    description: "A set of eight glazed stoneware vases for the spring faculty show.",
    tasks: [
      { name: "Glaze firing batch 3", due: "2026-10-19", status: "Done", priority: "Medium" },
      { name: "Photograph finished pieces", due: "2026-10-27", status: "In progress", priority: "Low" },
    ],
    todos: [
      { text: "Mix celadon glaze", column: "In progress" },
      { text: "Kiln shelf replacement", column: "On hold" },
      { text: "Throw vases 7 and 8", column: "Done" },
    ],
    gallery: [
      { title: "Vase glaze test", kind: "Photo", date: "2026-10-15" },
      { title: "Bisque batch", kind: "Photo", date: "2026-09-28" },
    ],
  },
  4: {
    created: "2026-05-11",
    description: "First draft of a 120-page graphic novel, starting with chapter 1 thumbnails.",
    tasks: [
      { name: "Chapter 1 thumbnails", due: "2026-11-10", status: "In progress", priority: "Medium" },
      { name: "Script pages 1 to 20", due: "2026-10-21", status: "In progress", priority: "High" },
      { name: "Character turnarounds", due: "2026-10-05", status: "Done", priority: "Low" },
    ],
    todos: [{ text: "Character sheets", column: "In progress" }],
    gallery: [{ title: "Character sheet", kind: "Drawing", date: "2026-10-02" }],
  },
  5: {
    created: "2026-08-25",
    description: "Suspended metal installation for the Northside Clinic lobby, fabricated with Priya's shop.",
    invoice: "northside-contract.pdf",
    amount: 12000,
    tasks: [
      { name: "Install site survey", due: "2026-11-03", status: "In progress", priority: "High" },
      { name: "Fabrication drawings", due: "2026-11-12", status: "In progress", priority: "Medium" },
    ],
    todos: [
      { text: "Call Dr. Osei about install date", column: "In progress" },
      { text: "Engineer sign-off", column: "On hold" },
    ],
    gallery: [{ title: "Lobby render", kind: "Render", date: "2026-10-12" }],
  },
  6: {
    created: "2026-04-03",
    description: "A 24-page risograph zine of sketchbook pages.",
    tasks: [
      { name: "Print test spreads", due: "2026-10-10", status: "In progress", priority: "Medium" },
      { name: "Pick paper stock", due: "2026-11-20", status: "In progress", priority: "Low" },
    ],
  },
  7: { created: "2026-06-20", description: "Twelve faculty portraits for the college's anniversary book.", invoice: "westbrook-final.pdf", amount: 3600 },
  8: { created: "2026-05-02", description: "Wayfinding signs for Eastside Gallery's new wing.", invoice: "eastside-invoice.pdf", amount: 2800 },
};

// Loose to-dos that don't belong to a project ("General" on the To-do board).
export const generalTodos = [
  { text: "Grade ARTS 210 midterm critiques", column: "In progress" },
  { text: "Renew studio insurance", column: "On hold" },
  { text: "Update portfolio site", column: "In progress" },
];
