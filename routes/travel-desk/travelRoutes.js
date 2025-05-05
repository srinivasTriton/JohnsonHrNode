const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
const baseURL = process.env.BASE_URL;
const dates = require("date-and-time");
const request = require("request");
const path = require("path");
const fs = require("fs");
const { executeOracleQuery } = require("../../config/oracle");
const mongoose = require("mongoose");

const moment = require("moment");

// TABLES
const EmployeeMaster = require("../../models/employeeMasterModel");
const LeaveDetail = require("../../models/leaveDetailModel");
const BranchMaster = require("../../models/branchMasterModel");
const Holiday = require("../../models/holidayModel");
const {
  Expense,
  Accommodation,
  Claim,
  TravelDesk,
} = require("../../models/travelDeskModel");

const {
  validateTravelExpense,
  validateBoardingExpense,
  validateLodgingExpense,
  validateCompositeExpense,
  validateConveyanceExpense,
  maxAmountOfLoading,
  maxAmountOfBoading,
  maxAmountComposite,
} = require("./travelShareRoutes");

const { createNotification } = require("../hr-admin/shareRoutes");

async function validateUserExistence(EMPNO) {
  const userExists = await EmployeeMaster.findOne({ ECODE: EMPNO });
  return userExists;
}

const formatDateMiddleware = (req, res, next) => {
  const originalJson = res.json;
  const recursiveFormatDates = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (obj[key] instanceof Date) {
          if (key === "CHECKINDTTIME" || key === "CHECKOUTDTTIME") {
            obj[key] = moment(obj[key]).format("hh:mm A"); // Format as HH:mm AM/PM
          } else {
            obj[key] = moment(obj[key]).format("DD-MM-YYYY");
          }
        } else if (typeof obj[key] === "object") {
          recursiveFormatDates(obj[key]);
        }
      }
    }
  };
  res.json = function (body) {
    if (typeof body === "object") {
      recursiveFormatDates(body);
    }
    originalJson.call(this, body);
  };
  next();
};

//router.use(formatDateMiddleware);

router.post("/my-travel-lists", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const travelLists = await TravelDesk.find({ employee: employeeId })
      .populate({
        path: "employee movement accommodation",
      })
      .populate({
        path: "travelId",
        model: "Expense",
      });

    if (!travelLists || travelLists.length === 0) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No travel lists found for the specified employee",
        Data: [],
        Code: 404,
      });
    }

    return res.status(200).json({
      Status: "Success",
      Message: "Travel lists retrieved successfully",
      Data: travelLists,
      Code: 200,
    });
  } catch (error) {
    console.error("Error retrieving travel lists:", error);
    return res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Data: [],
      Code: 500,
    });
  }
});

router.post("/travel-data", async (req, res) => {
  try {
    const { id } = req.body;
    const travelData = await TravelDesk.findById(id);
    if (!travelData) {
      return res.status(404).json({
        Status: "Failed",
        Message: "Travel data not found",
        Data: {},
        Code: 404,
      });
    }

    return res.status(200).json({
      Status: "Success",
      Message: "Travel data retrieved successfully",
      Data: travelData,
      Code: 200,
    });
  } catch (error) {
    console.error("Error retrieving travel data:", error);
    return res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Data: {},
      Code: 500,
    });
  }
});

// router.post('/add-expenses', async (req, res) => {
//     try {
//         console.log("=========req.body",req.body)
//         const { travelId, expensesData, type } = req.body;

//         if (!Array.isArray(expensesData)) {
//             return res.status(400).json({ Status: 'Failed', Message: 'Expenses should be an array', Code: 400 });
//         }

//         const travelDesk = await TravelDesk.findById(travelId).populate({
//             path: 'movement'
//         });
//         if (!travelDesk) {
//             return res.status(400).json({ Status: 'Failed', Message: 'Travel desk not found', Code: 400 });
//         }

//         const userExists = await EmployeeMaster.findById(travelDesk.employee);
//         if (!userExists) {
//             return res.status(404).json({ Status: 'Failed', Message: 'User not found', Code: 404 });
//         }
//         const grade = userExists.GRADE;
//         for (const expense of expensesData) {
//             const { date, amount, expenseClass, description, attachments, firstApproval, finalApproval, city, expenseDeviationData } = expense;
//             console.log("===expenseDeviationData",expenseDeviationData);
//             const duration = travelDesk.movement.TRAVELTIME;
//             console.log("===duration",duration);
//             if (!validateExpense(city, grade, amount, type, attachments, duration )) {
//                 return res.status(400).json({
//                     Status: 'Failed',
//                     Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade}`,
//                     Code: 400
//                 });
//             }

//             const expenseDate = moment(date, 'DD-MM-YYYY').toDate();

//             const newExpense = new Expense({
//                 travelId,
//                 date: expenseDate,
//                 amount,
//                 expenseClass: expenseClass,
//                 description,
//                 attachments,
//                 type,
//                 expenseDeviationData,
//                 firstApproval: { approver: firstApproval },
//                 finalApproval: { approver: finalApproval }
//             });
//             await newExpense.save();
//         }

//         res.json({ Status: 'Success', Message: 'Expenses created successfully', Code: 200 });
//     } catch (error) {
//         console.error('Error creating expenses:', error);
//         res.status(500).json({ Status: 'Failed', Message: 'Internal Server Error', Code: 500 });
//     }
// });

// router.post('/add-expenses', async (req, res) => {
//     try {
//         console.log("=========req.body", req.body);
//         const { travelId, expensesData, type } = req.body;

//         const travelDesk = await TravelDesk.findById(travelId).populate({ path: 'movement' });
//         if (!travelDesk) {
//             return res.status(400).json({ Status: 'Failed', Message: 'Travel desk not found', Code: 400 });
//         }

//         const userExists = await EmployeeMaster.findById(travelDesk.employee);
//         if (!userExists) {
//             return res.status(404).json({ Status: 'Failed', Message: 'User not found', Code: 404 });
//         }

//         const grade = userExists.GRADE;
//         const { city, totalAmount, description, firstApproval, finalApproval, expenseDeviationData, expenseDeviationTDA } = expensesData;

//         // Calculate durations
//         const departureDate = moment(travelDesk.movement.DEPARTUREDT);
//         const returnDate = moment(travelDesk.movement.RETURNDT);
//         const totalDuration = moment.duration(returnDate.diff(departureDate)).asDays() + 1; // Adding 1 to include the departure day
//         const travelDuration = travelDesk.movement.TRAVELTIME;

//         for (const expense of expenseDeviationData) {
//             const { date, amount, receipt, fromLoc, toLoc } = expense;
//             console.log("===expense", expense);
//             console.log("===totalDuration", totalDuration);
//             console.log("===travelDuration", travelDuration);

//             let isValid = false;
//             switch (type) {
//                 case 'TRAVEL':
//                     isValid = validateTravelExpense(city, grade, amount, totalDuration);
//                     break;
//                 case 'BOARDING':
//                     isValid = validateBoardingExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'LODGING':
//                     isValid = validateLodgingExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'COMPOSITE':
//                     isValid = validateCompositeExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'CONVEYANCE':
//                     isValid = validateConveyanceExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 default:
//                     isValid = false;
//                     break;
//             }

//             console.log("=======isValid", isValid);
//             if (!isValid) {
//                 return res.status(400).json({
//                     Status: 'Failed',
//                     Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade}`,
//                     Code: 400
//                 });
//             }
//         }

//         const newExpense = new Expense({
//             travelId,
//             totalAmount,
//             description,
//             city,
//             type,
//             totalDuration,
//             expenseDeviationData,
//             expenseDeviationTDA,
//             firstApproval: { approver: firstApproval },
//             finalApproval: { approver: finalApproval }
//         });
//         await newExpense.save();
//         res.json({ Status: 'Success', Message: 'Expenses created successfully', Code: 200 });
//     } catch (error) {
//         console.error('Error creating expenses:', error);
//         res.status(500).json({ Status: 'Failed', Message: 'Internal Server Error', Code: 500 });
//     }
// });

// router.post('/update-expenses', async (req, res) => {
//     try {
//         console.log("=========req.body", req.body);
//         const { expenseId, expensesData, type } = req.body;

//         const expense = await Expense.findById(expenseId);
//         if (!expense) {
//             return res.status(400).json({ Status: 'Failed', Message: 'Expense not found', Code: 400 });
//         }

//         const travelDesk = await TravelDesk.findById(expense.travelId).populate({ path: 'movement' });
//         if (!travelDesk) {
//             return res.status(400).json({ Status: 'Failed', Message: 'Travel desk not found', Code: 400 });
//         }

//         const userExists = await EmployeeMaster.findById(travelDesk.employee);
//         if (!userExists) {
//             return res.status(404).json({ Status: 'Failed', Message: 'User not found', Code: 404 });
//         }

//         const grade = userExists.GRADE;
//         const { city, totalAmount, description, firstApproval, finalApproval, expenseDeviationData, expenseDeviationTDA } = expensesData;

//         // Calculate durations
//         const departureDate = moment(travelDesk.movement.DEPARTUREDT);
//         const returnDate = moment(travelDesk.movement.RETURNDT);
//         const totalDuration = moment.duration(returnDate.diff(departureDate)).asDays() + 1; // Adding 1 to include the departure day
//         const travelDuration = travelDesk.movement.TRAVELTIME;

//         for (const expense of expenseDeviationData) {
//             const { date, amount, receipt, fromLoc, toLoc } = expense;
//             console.log("===expense", expense);
//             console.log("===totalDuration", totalDuration);
//             console.log("===travelDuration", travelDuration);

//             let isValid = false;
//             switch (type) {
//                 case 'TRAVEL':
//                     isValid = validateTravelExpense(city, grade, amount, totalDuration);
//                     break;
//                 case 'BOARDING':
//                     isValid = validateBoardingExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'LODGING':
//                     isValid = validateLodgingExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'COMPOSITE':
//                     isValid = validateCompositeExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 case 'CONVEYANCE':
//                     isValid = validateConveyanceExpense(city, grade, amount, receipt, totalDuration);
//                     break;
//                 default:
//                     isValid = false;
//                     break;
//             }

//             console.log("=======isValid", isValid);
//             if (!isValid) {
//                 return res.status(400).json({
//                     Status: 'Failed',
//                     Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade}`,
//                     Code: 400
//                 });
//             }
//         }

//         const updatedExpense = await Expense.findByIdAndUpdate(
//             expenseId,
//             {
//                 totalAmount,
//                 description,
//                 city,
//                 type,
//                 totalDuration,
//                 expenseDeviationData,
//                 expenseDeviationTDA,
//                 firstApproval: { approver: firstApproval },
//                 finalApproval: { approver: finalApproval }
//             },
//             { new: true }
//         );

//         if (!updatedExpense) {
//             return res.status(404).json({ Status: 'Failed', Message: 'Expense not found', Code: 404 });
//         }

//         res.json({ Status: 'Success', Message: 'Expenses updated successfully', Data: updatedExpense, Code: 200 });
//     } catch (error) {
//         console.error('Error updating expenses:', error);
//         res.status(500).json({ Status: 'Failed', Message: 'Internal Server Error', Code: 500 });
//     }
// });

// router.post('/approve-expense', async (req, res) => {
//     try {
//         const { expenseId, action, approver } = req.body;
//         const expense = await Expense.findById(expenseId);
//         if (!expense) {
//             return res.status(404).json({
//                 Status: 'Failed',
//                 Message: 'Expense not found',
//                 Code: 404
//             });
//         }

//         // Check if the expense has already been approved or rejected
//         if (expense.finalApproval.status !== 'PENDING') {
//             return res.status(400).json({
//                 Status: 'Failed',
//                 Message: 'Expense has already been processed',
//                 Code: 400
//             });
//         }

//         if (action === 'APPROVED') {
//             expense.finalApproval.approver = approver;
//             expense.finalApproval.status = 'APPROVED';
//         } else if (action === 'REJECTED') {
//             expense.finalApproval.approver = approver;
//             expense.finalApproval.status = 'REJECTED';
//         } else {
//             return res.status(400).json({
//                 Status: 'Failed',
//                 Message: 'Invalid action',
//                 Code: 400
//             });
//         }

//         if (expense.finalApproval.status !== 'APPROVED') {
//             return res.status(400).json({
//                 Status: 'Failed',
//                 Message: 'Both first and final approvals are required before creating or updating a claim',
//                 Code: 400
//             });
//         }
//         await expense.save();
//         let claim = await Claim.findOne({ travelId: expense.travelId });
//         if (claim) {
//             switch (expense.type) {
//                 case 'TRAVEL':
//                     const travelIndex = claim.travelExpenses.findIndex(e => e._id.equals(expense._id));
//                     if (travelIndex !== -1) {
//                         claim.travelExpenses[travelIndex] = expense;
//                     } else {
//                         claim.travelExpenses.push(expense);
//                     }
//                     break;
//                 case 'BOARDING':
//                     const boardingIndex = claim.boardingExpenses.findIndex(e => e._id.equals(expense._id));
//                     if (boardingIndex !== -1) {
//                         claim.boardingExpenses[boardingIndex] = expense;
//                     } else {
//                         claim.boardingExpenses.push(expense);
//                     }
//                     break;
//                 case 'LODGING':
//                     const lodgingIndex = claim.lodgingExpenses.findIndex(e => e._id.equals(expense._id));
//                     if (lodgingIndex !== -1) {
//                         claim.lodgingExpenses[lodgingIndex] = expense;
//                     } else {
//                         claim.lodgingExpenses.push(expense);
//                     }
//                     break;
//                 case 'COMPOSITE':
//                     const compositeIndex = claim.compositeExpenses.findIndex(e => e._id.equals(expense._id));
//                     if (compositeIndex !== -1) {
//                         claim.compositeExpenses[compositeIndex] = expense;
//                     } else {
//                         claim.compositeExpenses.push(expense);
//                     }
//                     break;
//                 case 'CONVEYANCE':
//                     const conveyanceIndex = claim.conveyanceExpenses.findIndex(e => e._id.equals(expense._id));
//                     if (conveyanceIndex !== -1) {
//                         claim.conveyanceExpenses[conveyanceIndex] = expense;
//                     } else {
//                         claim.conveyanceExpenses.push(expense);
//                     }
//                     break;
//                 default:
//                     return res.status(400).json({
//                         Status: 'Failed',
//                         Message: 'Invalid expense type',
//                         Code: 400
//                     });
//             }
//             await claim.save();
//         } else {
//             const claimExpenses = {
//                 TRAVEL: [],
//                 BOARDING: [],
//                 LODGING: [],
//                 COMPOSITE: [],
//                 CONVEYANCE: []
//             };
//             claimExpenses[expense.type].push(expense);

//             claim = new Claim({
//                 travelId: expense.travelId,
//                 travelExpenses: claimExpenses.TRAVEL,
//                 boardingExpenses: claimExpenses.BOARDING,
//                 lodgingExpenses: claimExpenses.LODGING,
//                 compositeExpenses: claimExpenses.COMPOSITE,
//                 conveyanceExpenses: claimExpenses.CONVEYANCE
//             });
//             await claim.save();
//         }

//         res.json({
//             Status: 'Success',
//             Message: `Expense ${action.toLowerCase()} successfully`,
//             Data: expense,
//             Code: 200
//         });
//     } catch (error) {
//         console.error('Error processing expense approval:', error);
//         res.status(500).json({
//             Status: 'Failed',
//             Message: 'Internal Server Error',
//             Code: 500
//         });
//     }
// });

router.post("/add-expenses", async (req, res) => {
  try {
    console.log("=========req.body", JSON.stringify(req.body));

    const {
      date,
      travelId,
      expenseDeviationData,
      imageData,
      firstApproval,
      finalApproval,
      expenseDeviationTDA,
      compositeHasValue,
      isFirstDate,
      isLastDate,
    } = req.body;

    // Validate required fields
    if (!date || !travelId) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Date and Travel ID are required",
        Code: 400,
      });
    }

    if (firstApproval.status === "" && finalApproval.status === "") {
      (firstApproval.status = "PENDING"), (finalApproval.status = "PENDING");
    }

    const travelDesk = await TravelDesk.findById(travelId).populate({
      path: "movement",
    });

    if (!travelDesk) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Travel desk not found",
        Code: 400,
      });
    }

    const userExists = await EmployeeMaster.findById(travelDesk.employee);
    if (!userExists) {
      return res
        .status(404)
        .json({ Status: "Failed", Message: "User not found", Code: 404 });
    }

    const grade = userExists.GRADE;
    const departureDate = moment(travelDesk.movement.DEPARTUREDT);
    const returnDate = moment(travelDesk.movement.RETURNDT);
    const totalDuration =
      moment.duration(returnDate.diff(departureDate)).asDays() + 1;

    const expenseTypes = [
      "TRAVEL",
      "COMPOSITE",
      "BOARDING",
      "LODGING",
      "CONVEYANCE",
    ];
    const expenseDate = moment(date, "DD-MM-YYYY").toDate();
    console.log("======date", date);
    console.log("======expenseDate", expenseDate);
    const validExpenses = {
      date: expenseDate,
    };

    // Initialize validExpenses with empty objects for each type
    expenseTypes.forEach((type) => {
      validExpenses[type] = {
        amount: type == "CONVEYANCE" || type == "TRAVEL" ? [] : 0,
        receipt: [],
        fromLoc: "",
        toLoc: "",
        description: "",
        city: "",
      };
    });

    let totalAmount = 0;
    let countAmount = 0;

    for (const [type, expenseData] of Object.entries(expenseDeviationData)) {
      if (expenseData) {
        let { amount, fromLoc, toLoc, description, city, amountDetails } =
          expenseData;
        const receipt = imageData[`${type.toLowerCase()}Receipt`] || [];
        let isValid = false;
        if (compositeHasValue) {
          isValid = true;
        }

        let checkBoardingBill = false;

        if (!city && +expenseDeviationData[type].amount > 0) {
         return res.status(400).json({
            Status: "Failed",
            Message: `Please enter city`,
            Code: 400,
          });
        }

        switch (type) {
          case "TRAVEL":
            if (amountDetails && amountDetails.length > 0) {
              let countTra = 0;

              for (const amtDetails of amountDetails) {
                isValid = validateTravelExpense(
                  city,
                  grade,
                  amtDetails.amount,
                  totalDuration
                );
                if (receipt.length < countTra || receipt.length == 0) {
                  return res.status(400).json({
                    Status: "Failed",
                    Message: `Upload bill`,
                    Code: 400,
                  });
                }
                countTra++;
                if (!isValid) {
                  break;
                }
              }
            }
            isValid = true;
            break;
          case "BOARDING":
            if (
              (!compositeHasValue && amount > 0) ||
              (compositeHasValue && amount > 0)
            ) {
              const BOARDINGAmount = maxAmountOfBoading(city, grade);
              console.log(
                BOARDINGAmount,
                "============================= BOARDINGAmount ==============================="
              );
              const boardMax = BOARDINGAmount;
              const bordMin = BOARDINGAmount * 0.5;

              console.log(
                bordMin,
                "============================ bordMin ================================="
              );
              console.log(
                amount,
                "========================================== amount =================================="
              );
              if (amount > bordMin && receipt.length == 0) {
                return res.status(400).json({
                  Status: "Failed",
                  Message: `Upload bill`,
                  Code: 400,
                });
              }
              if (
                amount > bordMin * 0.05 &&
                amount >= boardMax &&
                receipt.length == 0
              ) {
                return res.status(400).json({
                  Status: "Failed",
                  Message: `Upload bill`,
                  Code: 400,
                });
              }

              if (amount > boardMax + BOARDINGAmount * 0.05) {
                return res.status(400).json({
                  Status: "Failed",
                  Message: `Expense exceeds amount for ${type} in ${city} for grade ${grade}`,
                  Code: 400,
                });
              }

              if (amount > bordMin && receipt.length == 0) {
                // new added receipt.length == 0
                // <
                res.status(400).json({
                  Status: "Failed",
                  Message: `Expense exceeds amount for ${type} in ${city} for grade ${grade} without bill only half amount can be claimed as per policy`,
                  Code: 400,
                });
              }

              // BoardingExpense
              isValid = validateBoardingExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );

              console.log(
                "=============valid===================================",
                isValid
              );
            }
            isValid = true;
            break;
          case "LODGING":
            // if(!compositeHasValue){
            //     isValid = validateLodgingExpense(city, grade, amount, receipt, totalDuration);
            // }
            if (amount > 0 && receipt.length == 0) {
              return res.status(400).json({
                Status: "Failed",
                Message: `Upload lodging bill`,
                Code: 400,
              });
            }
            isValid = true;
            break;
          case "COMPOSITE":
            if (compositeHasValue) {
              let compAmount;

              if (travelDesk.movement.JOURNEYMODE === "CAR") {
                const carAmount = maxAmountComposite(city, grade);
                console.log(
                  carAmount,
                  "=============================== max carAmount ============================="
                );
                if (carAmount < 0) {
                  return res.status(400).json({
                    Status: "Failed",
                    Message: `Cannot find the maximum amount of composite`,
                    Code: 400,
                  });
                }
                if (amount > carAmount) {
                  return res.status(400).json({
                    Status: "Failed",
                    Message: `Composite amount for car is not in the policy range`,
                    Code: 400,
                  });
                }

                compAmount = (20 / 100) * carAmount;
                if (amount > compAmount) {
                  res.status(400).json({
                    Status: "Failed",
                    Message: `For car travel, you are allowed to claim only 20% . Claim amount  ${compAmount}`,
                    Code: 400,
                  });
                } else {
                  if (receipt.length > 0) {
                    isValid = validateCompositeExpense(
                      city,
                      grade,
                      amount,
                      receipt,
                      totalDuration
                    );
                    isValid = true;
                  } else {
                    res.status(400).json({
                      Status: "Failed",
                      Message: `Upload Food Bill - Travel By Car `,
                      Code: 400,
                    });
                  }
                }
                break;
              } else {
                const BOARDINGAmount = maxAmountOfBoading(city, grade);
                const LodingAmount = maxAmountOfLoading(city, grade);

                if (BOARDINGAmount < 0 || LodingAmount < 0) {
                  return res.status(400).json({
                    Status: "Failed",
                    Message: `Cannot find the maximum amount of bording and loding`,
                    Code: 400,
                  });
                }
                compAmount = (BOARDINGAmount + LodingAmount) * 0.5;
              }

              if (amount > compAmount) {
                res.status(400).json({
                  Status: "Failed",
                  Message: `Only 50% of the amount 0f bording and loding will claim according to the policy`,
                  Code: 400,
                });
              }

              if (isLastDate) {
                console.log(
                  compAmount,
                  "========================== compAmount ================================"
                );
                const lastDatePercentageAmt = compAmount * 0.3;
                console.log(
                  lastDatePercentageAmt,
                  "======================= lastDatePercentageAmt ================================="
                );
                console.log(
                  amount,
                  "======================= amount ================================="
                );
                if (amount > lastDatePercentageAmt) {
                  res.status(400).json({
                    Status: "Failed",
                    Message: `Only 30% of the amount 0f bording and loding will claim according to the policy for last day`,
                    Code: 400,
                  });
                }
              }
              isValid = validateCompositeExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );

              // added for composite

              validExpenses[type].amount = amount;
              validExpenses[type].receipt = receipt;
              validExpenses[type].fromLoc = fromLoc;
              validExpenses[type].toLoc = toLoc;
              validExpenses[type].description = description;
              validExpenses[type].city = city;
            }
            isValid = true;
            break;
          case "CONVEYANCE":
            if (amountDetails && amountDetails.length > 0) {
              console.log(
                "____________amountDetails and amountDetails.length________________________",
                amountDetails,
                amountDetails.length
              );
              let count = 0;
              for (const amtDetails of amountDetails) {
                const { bool, max } = validateConveyanceExpense(
                  city,
                  grade,
                  amtDetails.amount,
                  receipt,
                  totalDuration
                );
                console.log("CONVEYANCE amount", max);
                isValid = bool;
                if (max) {
                  if (receipt.length < count || receipt.length == 0) {
                    return res.status(400).json({
                      Status: "Failed",
                      Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade} amount is more so excepted a bill`,
                      Code: 400,
                    });
                  }
                }
                count++;
                if (!isValid) {
                  break;
                }
              }
            }
            isValid = true;
            break;
          default:
            isValid = false;
            break;
        }

        if (!isValid) {
          return res.status(400).json({
            Status: "Failed",
            Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade}`,
            Code: 400,
          });
        }

        if (type === "CONVEYANCE" || type === "TRAVEL") {
          if (amountDetails && amountDetails.length > 0) {
            for (const amtDetails of amountDetails) {
              validExpenses[type].amount.push({
                amount: amtDetails.amount,
                fromLoc: amtDetails.fromLoc,
                toLoc: amtDetails.toLoc,
              });
              validExpenses[type].receipt = receipt;
              validExpenses[type].description = description;
              validExpenses[type].city = city;
              countAmount += +amtDetails.amount;
            }
            amount = countAmount;
            countAmount = 0;
          }
        } else {
          if (!compositeHasValue) {
            // !compositeHasValue
            validExpenses[type].amount = amount;
            validExpenses[type].receipt = receipt;
            validExpenses[type].fromLoc = fromLoc;
            validExpenses[type].toLoc = toLoc;
            validExpenses[type].description = description;
            validExpenses[type].city = city;
          }
        }

        // Add expense data to validExpenses
        console.log("=====amount====", amount);
        if (amount) {
          totalAmount += parseInt(amount);
        }
      }
    }

    // Handle expenseDeviationTDA
    console.log("=====expenseDeviationTDA====", expenseDeviationTDA);
    console.log("=====totalAmount====", totalAmount);

    // Initialize validTDAExpenses
    const validTDAExpenses = [];
    let expenseDeviationTDAData;

    // Ensure expenseDeviationTDA is an array
    if (
      expenseDeviationTDA &&
      typeof expenseDeviationTDA === "object" &&
      !Array.isArray(expenseDeviationTDA)
    ) {
      expenseDeviationTDAData = [expenseDeviationTDA];
    }

    // Process each entry in the array
    if (expenseDeviationTDAData && Array.isArray(expenseDeviationTDAData)) {
      expenseDeviationTDAData.forEach((tda) => {
        const { ...types } = tda;
        const tdaEntry = { date: expenseDate };

        console.log("_________copy of types______", types);

        // Ensure the entry matches the schema
        expenseTypes.forEach((type) => {
          if (types[type]) {
            tdaEntry[type] = {
              amount: parseFloat(types[type].amount) || 0,
              fromLoc: types[type].fromLoc || "",
              toLoc: types[type].toLoc || "",
              receipt:
                imageData[
                  type == "BOARDING"
                    ? "boardingTDAReceipt"
                    : "compositeTDAReceipt"
                ],
              description: types[type].description,
              city: types[type].city,
            };
            if (+types[type].amount > 0) {
              totalAmount = totalAmount + +types[type].amount;
            }
          } else {
            tdaEntry[type] = {
              amount: 0,
              fromLoc: "",
              toLoc: "",
              receipt: "",
              description: "",
              city: "",
            };
          }
        });

        validTDAExpenses.push(tdaEntry);
      });
    }

    console.log("=====totalAmount====", totalAmount);

    console.log("=====validTDAExpenses====", validTDAExpenses);
    console.log("=====validExpenses====", validExpenses);

    console.log("__data to check__________________", validExpenses["TRAVEL"]);

    if (Object.keys(validExpenses).length > 1 || validTDAExpenses.length > 0) {
      const existingExpense = await Expense.findOne({
        travelId,
        "expenses.date": expenseDate,
      });
      console.log("=====existingExpense====", existingExpense);
      if (existingExpense) {
        // Update the existing expense entry
        await Expense.updateOne(
          { _id: existingExpense._id },
          {
            $set: {
              totalAmount,
              expenses: [validExpenses], // Note: Wrap validExpenses in an array
              expenseDeviationTDA: validTDAExpenses,
              // expenseDeviationData: expenseDeviationData
              //   ? expenseDeviationData
              //   : [],
              firstApproval,
              finalApproval,
            },
          }
        );
        res.json({
          Status: "Success",
          Message: "Expenses updated successfully",
          Code: 200,
        });
      } else {
        // Create a new expense entry
        console.log(
          firstApproval,
          "===================== firstApproval ==================="
        );
        console.log(
          finalApproval,
          "===================== finalApproval ==================="
        );

        const date = new Date();
        const timestamp = moment(date).format("YY-MM-DD-HH-mm");

      
        const count = await Expense.countDocuments({
          seq_no: { $regex: `^${timestamp}` },
        });

       
        const increment = String(count + 1).padStart(2, "0"); 
        const seq_no = `${timestamp}-${increment}`;

        const newExpense = new Expense({
          travelId,
          totalAmount,
          expenses: [validExpenses], 
          expenseDeviationTDA: validTDAExpenses,
          firstApproval,
          finalApproval,
          seq_no
        });
        await newExpense.save();
        res.json({
          Status: "Success",
          Message: "Expenses created successfully",
          Code: 200,
        });
      }
    } else {
      res.status(400).json({
        Status: "Failed",
        Message: "No valid expenses to create or update",
        Code: 400,
      });
    }
  } catch (error) {
    console.error("Error creating/updating expenses:", error);
    res
      .status(500)
      .json({ Status: "Failed", Message: "Internal Server Error", Code: 500 });
  }
});

router.post("/update-expenses", async (req, res) => {
  try {
    console.log("=========req.body", req.body);
    const { expenseId, expensesData } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res
        .status(400)
        .json({ Status: "Failed", Message: "Expense not found", Code: 400 });
    }

    const travelDesk = await TravelDesk.findById(expense.travelId).populate({
      path: "movement",
    });
    if (!travelDesk) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Travel desk not found",
        Code: 400,
      });
    }

    const userExists = await EmployeeMaster.findById(travelDesk.employee);
    if (!userExists) {
      return res
        .status(404)
        .json({ Status: "Failed", Message: "User not found", Code: 404 });
    }

    const grade = userExists.GRADE;
    const {
      city,
      totalAmount,
      description,
      firstApproval,
      finalApproval,
      expenses,
      expenseDeviationTDA,
    } = expensesData;

    // Calculate durations
    const departureDate = moment(travelDesk.movement.DEPARTUREDT);
    const returnDate = moment(travelDesk.movement.RETURNDT);
    const totalDuration =
      moment.duration(returnDate.diff(departureDate)).asDays() + 1; // Adding 1 to include the departure day

    const validExpenses = [];
    let calculatedTotalAmount = 0;

    for (const expenseData of expenses) {
      const { date, TRAVEL, COMPOSITE, BOARDING, LODGING, CONVEYANCE } =
        expenseData;

      const types = { TRAVEL, COMPOSITE, BOARDING, LODGING, CONVEYANCE };

      for (const [type, expenseDetail] of Object.entries(types)) {
        if (expenseDetail) {
          const {
            amount,
            receipt,
            fromLoc,
            toLoc,
            description: expDescription,
            city: expCity,
          } = expenseDetail;

          let isValid = false;
          switch (type) {
            case "TRAVEL":
              isValid = validateTravelExpense(
                city,
                grade,
                amount,
                totalDuration
              );
              break;
            case "BOARDING":
              isValid = validateBoardingExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );
              break;
            case "LODGING":
              isValid = validateLodgingExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );
              break;
            case "COMPOSITE":
              isValid = validateCompositeExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );
              break;
            case "CONVEYANCE":
              const { bool, max } = validateConveyanceExpense(
                city,
                grade,
                amount,
                receipt,
                totalDuration
              );
              isValid = bool;
              break;
            default:
              isValid = false;
              break;
          }

          if (!isValid) {
            return res.status(400).json({
              Status: "Failed",
              Message: `Expense exceeds the allowed amount for ${type} in ${city} for grade ${grade}`,
              Code: 400,
            });
          }

          validExpenses.push({
            date,
            type,
            amount,
            receipt,
            fromLoc,
            toLoc,
            description: expDescription,
            city: expCity,
          });
          calculatedTotalAmount += amount; // Sum up the amounts
        }
      }
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      {
        totalAmount: calculatedTotalAmount,
        description,
        city,
        totalDuration,
        expenses: validExpenses,
        expenseDeviationTDA,
        firstApproval: { approver: firstApproval },
        finalApproval: { approver: finalApproval },
      },
      { new: true } // Return the updated document
    );

    if (!updatedExpense) {
      return res
        .status(404)
        .json({ Status: "Failed", Message: "Expense not found", Code: 404 });
    }

    res.json({
      Status: "Success",
      Message: "Expenses updated successfully",
      Data: updatedExpense,
      Code: 200,
    });
  } catch (error) {
    console.error("Error updating expenses:", error);
    res
      .status(500)
      .json({ Status: "Failed", Message: "Internal Server Error", Code: 500 });
  }
});

router.post("/approve-expense", async (req, res) => {
  try {
    const { expenseId, action, approver } = req.body;

    // Find the expense by ID
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        Status: "Failed",
        Message: "Expense not found",
        Code: 404,
      });
    }

    // Check if the expense has already been approved or rejected
    if (expense.finalApproval.status !== "PENDING") {
      return res.status(400).json({
        Status: "Failed",
        Message: "Expense has already been processed",
        Code: 400,
      });
    }

    // Update the expense based on the action
    if (action === "APPROVED") {
      expense.finalApproval.approver = approver;
      expense.finalApproval.status = "APPROVED";
    } else if (action === "REJECTED") {
      expense.finalApproval.approver = approver;
      expense.finalApproval.status = "REJECTED";
    } else {
      return res.status(400).json({
        Status: "Failed",
        Message: "Invalid action",
        Code: 400,
      });
    }

    // Check if final approval was successful
    if (expense.finalApproval.status !== "APPROVED") {
      return res.status(400).json({
        Status: "Failed",
        Message: "Expense must be approved to be finalized",
        Code: 400,
      });
    }

    // Save the updated expense
    await expense.save();

    // Response for successful approval
    res.json({
      Status: "Success",
      Message: `Expense ${action.toLowerCase()} successfully`,
      Data: expense,
      Code: 200,
    });
  } catch (error) {
    console.error("Error processing expense approval:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

// router.post('/expense-listby-travel', async (req, res) => {
//     try {
//         const travelId = req.body.travelId;
//         const expenseData = await Expense.findOne({ travelId: travelId });
//         console.log("=======expenseData",expenseData);
//         if (!expenseData || expenseData.length === 0) {
//             return res.status(404).json({
//                 Status: 'Failed',
//                 Message: 'No expense found for the specified travelId',
//                 Code: 404
//             });
//         }
//         res.status(200).json({
//             Status: 'Success',
//             Message: 'Expense retrieved successfully',
//             Code: 200,
//             Data: expenseData
//         });
//     } catch (error) {
//         console.error('Error retrieving expense:', error);
//         res.status(500).json({
//             Status: 'Failed',
//             Message: 'Internal Server Error',
//             Code: 500
//         });
//     }
// });

// router.post('/expense-listby-travel', async (req, res) => {
//     try {
//         const travelId = req.body.travelId;
//         const expenseData = await Expense.find({ travelId });

//         if (!expenseData || expenseData.length === 0) {
//             return res.status(404).json({
//                 Status: 'Failed',
//                 Message: 'No expense found for the specified travelId',
//                 Code: 404
//             });
//         }

//         // Check for LARRANGEMENTS and CARRANGEMENTS in the travel desk data if needed
//         const travelDeskData = await TravelDesk.findById(travelId)
//             .populate('movement', 'LARRANGEMENTS CARRANGEMENTS')
//             .exec();

//         const { LARRANGEMENTS, CARRANGEMENTS } = travelDeskData?.movement || {};

//         // Check if any expense includes BOARDING or LODGING types
//         const BLFLAG = expenseData.some(expense => {
//             return Object.keys(expense.expenses).some(key => ['BOARDING', 'LODGING'].includes(key));
//         });

//         // Check if any expense includes COMPOSITE type
//         const CFLAG = expenseData.some(expense => {
//             return Object.keys(expense.expenses).includes('COMPOSITE');
//         });

//         res.status(200).json({
//             Status: 'Success',
//             Message: 'Expense retrieved successfully',
//             Data: expenseData,
//             Code: 200,
//             // LARRANGEMENTS,
//             // CARRANGEMENTS,
//             // BLFLAG,
//             // CFLAG,

//         });
//     } catch (error) {
//         console.error('Error retrieving expense:', error);
//         res.status(500).json({
//             Status: 'Failed',
//             Message: 'Internal Server Error',
//             Code: 500
//         });
//     }
// });

router.post("/expense-listby-travel", async (req, res) => {
  try {
    const { travelId } = req.body;

    let expenseData = await Expense.find(
      { travelId },
      {
        expenses: 1,
        expenseDeviationTDA: 1,
        date: 1,
        totalAmount: 1,
        travelId: 1,
        firstApproval: 1,
        finalApproval: 1,
      }
    );

    if (!expenseData || expenseData.length === 0) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No expense found for the specified travelId",
        Code: 404,
      });
    }

    // Check for LARRANGEMENTS and CARRANGEMENTS in the travel desk data if needed
    const travelDeskData = await TravelDesk.findById(travelId)
      .populate("movement", "LARRANGEMENTS CARRANGEMENTS")
      .exec();

    const { LARRANGEMENTS, CARRANGEMENTS } = travelDeskData?.movement || {};

    // Check if any expense includes BOARDING or LODGING types
    const BLFLAG = expenseData.some((expense) => {
      return Object.keys(expense.expenses).some((key) =>
        ["BOARDING", "LODGING"].includes(key)
      );
    });

    // Check if any expense includes COMPOSITE type
    const CFLAG = expenseData.some((expense) => {
      return Object.keys(expense.expenses).includes("COMPOSITE");
    });

    expenseData = expenseData.map((expense) => {
      const clonedExpense = JSON.parse(JSON.stringify(expense));
      if (clonedExpense.expenses) {
        clonedExpense.expenses.forEach((exp) => {
          exp.date = moment(exp.date).format("DD-MM-YYYY");
        });
      }
      if (clonedExpense.expenseDeviationTDA) {
        clonedExpense.expenseDeviationTDA.forEach((deviation) => {
          deviation.date = moment(deviation.date).format("DD-MM-YYYY");
        });
      }
      return clonedExpense;
    });
    const expensesData = [];
    const expenseTdaData = [];
    let totalAmountOfexp = 0;
    for (const element of expenseData) {
      totalAmountOfexp = totalAmountOfexp + element.totalAmount;
      //Combing the expenseData into into single array
      for (const exp of element.expenses) {
        console.log(
          element.expenses,
          "================================= element.expenses"
        );
        expensesData.push(exp);
      }
      //Combing the expenseDeviationTDA into into single array
      for (const exptd of element.expenseDeviationTDA) {
        expenseTdaData.push(exptd);
      }
    }

    const obj = {
      _id: expenseData[0]._id,
      totalAmount: totalAmountOfexp,
      travelId: expenseData[0].travelId,
      expenses: expensesData,
      expenseDeviationTDA: expenseTdaData,
      firstApproval: expenseData[0].firstApproval,
      finalApproval: expenseData[0].finalApproval,
    };

    console.log("=====expenseData", expenseData);

    res.status(200).json({
      Status: "Success",
      Message: "Expense retrieved successfully",
      Data: [obj],
      Code: 200,
      // LARRANGEMENTS,
      // CARRANGEMENTS,
      // BLFLAG,
      // CFLAG,
    });
  } catch (error) {
    console.error("Error retrieving expense:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.post("/expense-data", async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Expense ID is required",
        Code: 400,
      });
    }

    // Step 1: Fetch expense data by ID
    const expenseData = await Expense.findById(expenseId).lean();

    if (!expenseData) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No expense found for the specified expenseId",
        Code: 404,
      });
    }

    // Step 2: Fetch travel data using travelId from expense data
    const travelData = await TravelDesk.findById(expenseData.travelId)
      .select("movement")
      .lean();

    if (!travelData) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No travel data found for the specified travelId",
        Code: 404,
      });
    }

    const movementData = await LeaveDetail.findById(travelData.movement)
      .select("DEPARTUREDT RETURNDT")
      .lean();

    if (!movementData) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No movement data found for the specified movement ID",
        Code: 404,
      });
    }

    // Combine data
    const responseData = {
      ...expenseData,
      movement: movementData,
    };

    res.status(200).json({
      Status: "Success",
      Message: "Expense retrieved successfully",
      Code: 200,
      Data: responseData,
    });
  } catch (error) {
    console.error("Error retrieving expense:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.post("/create-accommodation", async (req, res) => {
  try {
    let {
      travelId,
      employee,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      placeVisited,
      city,
      hotelName,
      description,
    } = req.body;
    if (
      !travelId ||
      !employee ||
      !checkInDate ||
      !checkOutDate ||
      !placeVisited ||
      !city ||
      !hotelName
    ) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Missing required fields",
        Code: 400,
      });
    }
    checkInDate = moment(checkInDate, "DD-MM-YYYY").toDate();
    checkOutDate = moment(checkOutDate, "DD-MM-YYYY").toDate();

    const newAccommodation = new Accommodation({
      travelId,
      employee,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      placeVisited,
      city,
      hotelName,
      description,
    });
    await newAccommodation.save();

    res.status(201).json({
      Status: "Success",
      Message: "Accommodation created successfully",
      Code: 201,
      Data: newAccommodation,
    });
  } catch (error) {
    console.error("Error creating accommodation:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.post("/accommodation-listby-travel", async (req, res) => {
  try {
    const travelId = req.body.travelId;
    const accommodations = await Accommodation.find({ travelId });
    if (!accommodations || accommodations.length === 0) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No accommodations found for the specified travelId",
        Code: 404,
      });
    }
    res.status(200).json({
      Status: "Success",
      Message: "Accommodations retrieved successfully",
      Code: 200,
      Data: accommodations,
    });
  } catch (error) {
    console.error("Error retrieving accommodations:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.post("/accommodation-data", async (req, res) => {
  try {
    const accommodationsId = req.body.accommodationsId;
    const accommodationData = await Accommodation.findById(accommodationsId);
    if (!accommodationData || accommodationData.length === 0) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No accommodation found for the specified travelId",
        Code: 404,
      });
    }
    res.status(200).json({
      Status: "Success",
      Message: "Accommodation retrieved successfully",
      Code: 200,
      Data: accommodationData,
    });
  } catch (error) {
    console.error("Error retrieving expense:", error);
    res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.post("/update-expense-amount", async (req, res) => {
  try {
    const data = await Expense.findOneAndUpdate(
      { "expenses._id": new mongoose.Types.ObjectId(req.body.expenses._id) },
      {
        $set: {
          expenses: req.body.expenses,
        },
      }
    );
    const data1 = await Expense.findOneAndUpdate(
      {
        "expenseDeviationTDA._id": new mongoose.Types.ObjectId(
          req.body.expenseTDA._id
        ),
      },
      {
        $set: {
          expenseDeviationTDA: req.body.expenseTDA,
        },
      }
    );
    return res.status(200).json({
      Status: "Success",
      Message: "Expense Updated successfully",
      Data: data,
      Code: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

router.get("/registerCheck", async (req, res) => {
  try {
    return res.status(200).json({
      Status: "Success",
      Message: "Registered successfully",
      Data: true,
      Code: 200,
    });
  } catch (err) {
    return res.status(500).json({
      Status: "Failed",
      Message: "Internal Server Error",
      Code: 500,
    });
  }
});

module.exports = router;
