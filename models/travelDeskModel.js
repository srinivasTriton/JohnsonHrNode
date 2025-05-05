const mongoose = require("mongoose");

// Schema for Expense
const ExpenseSchema = new mongoose.Schema({
  travelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TravelDesk",
    required: true,
  },
  seq_no:{type:String,default:""},
  totalAmount: { type: Number, required: true },
  description: { type: String },
  city: { type: String },
  totalDuration: { type: String },
  expenseDeviationTDA: [
    {
      date: { type: Date, required: true },
      COMPOSITE: {
        amount: { type: Number, required: true },
        fromLoc: { type: String },
        toLoc: { type: String },
        modified_amount: {
          type: Number,
        },
      },
      BOARDING: {
        amount: { type: Number, required: true },
        fromLoc: { type: String },
        toLoc: { type: String },
        modified_amount: {
          type: Number,
        },
      },
    },
  ],
  expenses: [
    {
      date: { type: Date, required: true },
      TRAVEL: {
        amount: {
          type: [
            {
              amount: {
                type: Number,
                required: true,
              },
              modified_amount: {
                type: Number,
              },
              fromLoc: {
                type: String,
                required: true,
              },
              toLoc: {
                type: String,
                required: true,
              },
            },
          ],
          required: true,
        },
        receipt: { type: [String], required: true },
        description: { type: String },
        city: { type: String },
      },
      COMPOSITE: {
        amount: { type: Number },
        modified_amount: {
          type: Number,
        },
        receipt: { type: [String] },
        fromLoc: { type: String },
        toLoc: { type: String },
        description: { type: String },
        city: { type: String },
      },
      BOARDING: {
        amount: { type: Number },
        modified_amount: {
          type: Number,
        },
        receipt: { type: [String] },
        fromLoc: { type: String },
        toLoc: { type: String },
        description: { type: String },
        city: { type: String },
      },
      LODGING: {
        amount: { type: Number },
        modified_amount: {
          type: Number,
        },
        receipt: { type: [String] },
        fromLoc: { type: String },
        toLoc: { type: String },
        description: { type: String },
        city: { type: String },
      },
      CONVEYANCE: {
        amount: {
          type: [
            {
              amount: {
                type: Number,
                required: true,
              },
              modified_amount: {
                type: Number,
              },
              fromLoc: {
                type: String,
                required: true,
              },
              toLoc: {
                type: String,
                required: true,
              },
            },
          ],
          required: true,
        },
        receipt: { type: [String], required: true },
        description: { type: String },
        city: { type: String },
      },
      expenseApproval: {
        approver: { type: String },
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING",
        },
      },
    },
  ],
  firstApproval: {
    approver: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  finalApproval: {
    approver: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    claimApprovedAt: { type: Date },
  },
  amountSettled: {
    approver: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SETTLED"],
      default: "PENDING",
    },
    claimSettledAt: { type: Date },
  },
  createdAt: { type: Date, default: new Date() },
  updatedAt: { type: Date, default: new Date() },
});

const Expense = mongoose.model("Expense", ExpenseSchema);

// Schema for Accommodation
const AccommodationSchema = new mongoose.Schema({
  travelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TravelDesk",
    required: true,
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmployeeMaster",
    required: true,
  },
  approvals: {
    approver: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  checkInDate: { type: Date, required: true },
  checkInTime: String,
  checkOutDate: { type: Date, required: true },
  checkOutTime: String,
  placeVisited: String,
  city: String,
  hotelName: String,
  description: String,
});

const Accommodation = mongoose.model("Accommodation", AccommodationSchema);

const TravelDeskSchema = new mongoose.Schema(
  {
    travelId: { type: String, unique: true, required: true },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeMaster",
      required: true,
    },
    movement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveDetail",
      required: true,
    },
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: false,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    brcode: { type: String, ref: "BranchMaster", required: true },
    ticketDocuments: { type: Array },
    accommodationDocuments: { type: Array },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const TravelDesk = mongoose.model("TravelDesk", TravelDeskSchema);

module.exports = { Expense, Accommodation, TravelDesk };
