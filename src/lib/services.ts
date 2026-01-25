
export type ServiceCategory = keyof typeof servicePackages;

export const servicePackages = {
  "Full Vehicle Packages": [
    "Complete Full Detail",
    "Premium Full Detail",
    "Ultimate Full Detail + Ceramic Protection",
  ],
  "Ceramic Coating Packages": [
    "OPX Ceramic Coating – Tier 1",
    "OP3 Ceramic Coating – Tier 2",
    "OP5 Ceramic Coating – Tier 3",
    "OP7 Ceramic Coating – Tier 4",
    "OP9 Ceramic Coating – Tier 5",
  ],
  "Exterior Packages": [
    "Premium Exterior Detail", 
    "Signature Exterior Detail"
  ],
  "Interior Packages": [
    "Premium Interior Detail", 
    "Signature Interior Detail"
  ],
};

export const addOns = [
  "Engine Bay Detail",
  "Headlight Restoration",
  "Pet Hair Removal",
  "Ozone Treatment",
  "Glass Coating (OP Glass)",
  "Interior Ceramic Coating",
  "OPX Ceramic Topper",
  "Undercarriage Wash",
  "Trim Restoration",
  "Fabric/Seat Waterproofing",
  "Bug/Tar/Sap Removal",
  "Extra Dirty Fee",
];

export const serviceCategories = Object.keys(servicePackages) as ServiceCategory[];
